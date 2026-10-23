#!/usr/bin/env python3
"""Verifica atualizações das imagens Docker de terceiros usadas pela loja e abre PRs (como o Dependabot).

Para cada app ruiz-*:
  - lê as imagens fixadas por versão nos docker-compose.yml (image:) e Dockerfiles (FROM);
  - procura no Docker Hub a versão mais nova com o mesmo formato de tag (mesmo prefixo "v", mesma
    quantidade de números e mesmo sufixo, como -management ou -lts-jdk21) e a mesma versão maior;
  - se houver novidades, cria/atualiza a branch deps/<app> com os tags novos e a versão do app
    ajustada (o Umbrel só oferece a atualização quando a versão muda) e abre/atualiza o PR.

Imagens flutuantes (latest, alpine, node:24-alpine...) e as imagens da própria loja (<ns>/ruiz-*) ficam de
fora. Versões maiores novas só aparecem como aviso no PR. Ajustes em image-updates.json.

Uso:  python3 scripts/image_updates.py [--dry-run]
Variáveis para abrir PRs: GH_USER, GH_TOKEN (permissões Contents e Pull requests: escrita).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = os.environ.get("GH_REPO", "CaioRuizz/ruiz-app-store")
BASE = os.environ.get("GH_BASE", "master")
CONFIG_FILE = ROOT / "image-updates.json"

COMPOSE_RE = re.compile(r"^(\s*image:\s*)([^\s:@#]+):([^\s@#]+)\s*$")
FROM_RE = re.compile(r"^(FROM\s+(?:--platform=\S+\s+)?)([^\s:@]+):([^\s@]+)(.*)$", re.IGNORECASE)
# Tags no formato [v]1.2.3[-sufixo]; o sufixo precisa começar com letra (exclui rc/beta numéricos)
SEMVER_RE = re.compile(r"^(v?)(\d+(?:\.\d+)*)(-[A-Za-z][\w.-]*)?$")
# Tags do jenkins/agent: <build>.v<hash>-<revisão>-<sufixo>
JENKINS_RE = re.compile(r"^(\d+)\.v[0-9a-f_]+-(\d+)(-[\w.-]+)?$")
PRERELEASE_RE = re.compile(r"(rc|alpha|beta|preview|dev)\d*", re.IGNORECASE)
VERSION_RE = re.compile(r'^(version:\s*)"?([^"\s]+)"?\s*$', re.MULTILINE)


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------------------------
# Formato das tags


def parse_tag(tag: str):
    """Devolve (chave de comparação, assinatura do formato) ou None se a tag não for versionada."""
    m = SEMVER_RE.match(tag)
    if m and not PRERELEASE_RE.search(m.group(3) or ""):
        nums = tuple(int(x) for x in m.group(2).split("."))
        return nums, ("semver", m.group(1), len(nums), m.group(3) or "")
    m = JENKINS_RE.match(tag)
    if m:
        return (int(m.group(1)), int(m.group(2))), ("jenkins", m.group(3) or "")
    return None


def plain_version(tag: str) -> str:
    """'v3.15.0' -> '3.15.0'; '4.3.6-management' -> '4.3.6'."""
    m = SEMVER_RE.match(tag)
    return m.group(2) if m else tag


# ---------------------------------------------------------------------------------------------
# Docker Hub


def hub_repo(image: str) -> str | None:
    if image.count("/") == 0:
        return f"library/{image}"
    first = image.split("/")[0]
    if "." in first or ":" in first or first == "localhost":
        return None  # outro registry (ghcr.io, quay.io...): não suportado ainda
    return image


def hub_tags(repo: str, name_filter: str, max_pages: int = 10) -> list[str]:
    tags: list[str] = []
    url = (f"https://hub.docker.com/v2/repositories/{repo}/tags?page_size=100&ordering=last_updated"
           f"&name={urllib.parse.quote(name_filter)}")
    for _ in range(max_pages):
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.load(r)
        tags += [t["name"] for t in data.get("results", [])]
        url = data.get("next")
        if not url:
            break
    return tags


def find_updates(image: str, tag: str, allow_major: bool):
    """Devolve (tag nova ou None, maior versão maior disponível ou None)."""
    parsed = parse_tag(tag)
    repo = hub_repo(image)
    if not parsed or not repo:
        return None, None
    key, sig = parsed
    name_filter = sig[-1] if sig[-1] else ""
    best, best_key, newest_major = None, key, None
    for candidate in hub_tags(repo, name_filter):
        p = parse_tag(candidate)
        if not p or p[1] != sig:
            continue
        ckey = p[0]
        if ckey[0] != key[0]:
            if ckey[0] > key[0] and (newest_major is None or ckey > newest_major[0]):
                newest_major = (ckey, candidate)
            if not allow_major:
                continue
        if ckey > best_key:
            best, best_key = candidate, ckey
    return best, (newest_major[1] if newest_major else None)


# ---------------------------------------------------------------------------------------------
# Leitura e escrita dos arquivos dos apps


def image_refs(app_dir: Path):
    """Lista (arquivo, nº da linha, prefixo, imagem, tag, resto) das imagens fixadas de um app."""
    refs = []
    files = sorted(app_dir.glob("docker-compose.yml")) + sorted(app_dir.glob("*/Dockerfile"))
    for f in files:
        for i, line in enumerate(f.read_text().splitlines()):
            m = (COMPOSE_RE if f.name == "docker-compose.yml" else FROM_RE).match(line)
            if not m:
                continue
            prefix, image, tag = m.group(1), m.group(2), m.group(3)
            rest = m.group(4) if f.name != "docker-compose.yml" else ""
            if re.match(r"^[^/]+/ruiz-", image) or "$" in image + tag:
                continue  # imagem da própria loja ou com variável
            refs.append((f, i, prefix, image, tag, rest))
    return refs


def bump_app_version(current: str, primary_new: str | None, tracks_image: bool) -> str:
    """Nova versão do app: a da imagem principal, um "-N" ou o patch seguinte."""
    if primary_new:
        return primary_new
    if tracks_image:
        m = re.match(r"^(.*?)(?:-(\d+))?$", current)
        return f"{m.group(1)}-{int(m.group(2) or 0) + 1}"
    nums = re.match(r"^(\d+)\.(\d+)\.(\d+)$", current)
    if nums:
        return f"{nums.group(1)}.{nums.group(2)}.{int(nums.group(3)) + 1}"
    return f"{current}-1"


def plan_app(app_dir: Path, config: dict):
    manifest = (app_dir / "umbrel-app.yml").read_text()
    vm = VERSION_RE.search(manifest)
    app_version = vm.group(2) if vm else ""
    base_version = app_version.split("-")[0]
    changes, notes, seen = [], [], {}
    for f, i, prefix, image, tag, rest in image_refs(app_dir):
        if image in config.get("ignore", []):
            continue
        if (image, tag) not in seen:
            try:
                seen[(image, tag)] = find_updates(image, tag, image in config.get("allow_major", []))
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                log(f"  ! {image}:{tag}: falha ao consultar o Docker Hub ({e})")
                seen[(image, tag)] = (None, None)
        new, major = seen[(image, tag)]
        if new:
            changes.append((f, i, prefix, image, tag, new, rest))
        if major and f"{image}:{major}" not in notes:
            notes.append(f"{image}:{major}")
    if not changes:
        return None
    # A versão do app acompanha a de uma imagem quando são iguais (ex.: Redis 8.8.3 / redis:8.8.3)
    tracking = [c for c in image_refs(app_dir) if plain_version(c[4]) == base_version]
    tracks_image = bool(tracking)
    primary_new = None
    for f, i, prefix, image, tag, new, rest in changes:
        if any(t[3] == image for t in tracking):
            primary_new = plain_version(new)
    new_version = bump_app_version(app_version, primary_new, tracks_image)
    return {"app": app_dir.name, "version": app_version, "new_version": new_version,
            "changes": changes, "major_notes": notes}


def apply_plan(plan) -> None:
    by_file: dict[Path, list[str]] = {}
    for f, i, prefix, image, tag, new, rest in plan["changes"]:
        lines = by_file.setdefault(f, f.read_text().splitlines())
        lines[i] = f"{prefix}{image}:{new}{rest}"
    for f, lines in by_file.items():
        f.write_text("\n".join(lines) + "\n")
    # Mantém em dia as versões citadas no README do app (ex.: "`redis:8.8.3`")
    readme = ROOT / plan["app"] / "README.md"
    if readme.exists():
        text = readme.read_text()
        for _, _, _, image, tag, new, _ in plan["changes"]:
            text = text.replace(f"{image}:{tag}", f"{image}:{new}")
        readme.write_text(text)
    manifest = ROOT / plan["app"] / "umbrel-app.yml"
    text = manifest.read_text()
    text = VERSION_RE.sub(lambda m: f'{m.group(1)}"{plan["new_version"]}"', text, count=1)
    summary = ", ".join(sorted({f"{image} {new}" for _, _, _, image, _, new, _ in plan["changes"]}))
    text = re.sub(r'^releaseNotes:.*$', f'releaseNotes: "Updates {summary}."', text, count=1,
                  flags=re.MULTILINE)
    manifest.write_text(text)


# ---------------------------------------------------------------------------------------------
# Git e GitHub


def git(*args: str, check: bool = True) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=check, text=True,
                          capture_output=True).stdout.strip()


def github(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(
        f"https://api.github.com{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
                 "Accept": "application/vnd.github+json", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def pr_text(plan) -> tuple[str, str]:
    rows = sorted({(image, tag, new) for _, _, _, image, tag, new, _ in plan["changes"]})
    if len(rows) == 1:
        image, tag, new = rows[0]
        title = f"deps({plan['app']}): {image} {tag} → {new}"
    else:
        title = f"deps({plan['app']}): atualiza {len(rows)} imagens"
    body = ["Atualização automática das imagens Docker (verificação diária do Jenkins).", "",
            "| Imagem | Atual | Nova |", "| --- | --- | --- |"]
    body += [f"| `{image}` | `{tag}` | `{new}` |" for image, tag, new in rows]
    body += ["", f"Versão do app: `{plan['version']}` → `{plan['new_version']}` "
             "(o Umbrel só oferece a atualização quando a versão muda)."]
    if plan["major_notes"]:
        body += ["", "**Versões maiores disponíveis** (não incluídas; podem exigir migração):"]
        body += [f"- `{n}`" for n in plan["major_notes"]]
    body += ["", "Antes de fazer o merge, confira as notas de versão das imagens. "
             "Depois do merge, atualize o app no Umbrel."]
    return title, "\n".join(body)


def publish(plan, dry_run: bool) -> None:
    app, branch = plan["app"], f"deps/{plan['app']}"
    title, body = pr_text(plan)
    log(f"  {title}")
    if dry_run:
        for _, _, _, image, tag, new, _ in plan["changes"]:
            log(f"    {image}: {tag} -> {new}")
        log(f"    versão do app: {plan['version']} -> {plan['new_version']}")
        return
    auth = ["-c", "credential.helper=!f() { echo username=$GH_USER; echo password=$GH_TOKEN; }; f"]
    remote = os.environ.get("GH_REMOTE", f"https://github.com/{REPO}.git")
    git("checkout", "-q", "-B", branch, f"origin/{BASE}")
    git("clean", "-fdq", "--", app)
    apply_plan(plan)
    git("add", "-A", app)
    git("-c", "user.name=Jenkins", "-c", "user.email=jenkins@caioruiz.com",
        "commit", "-q", "-m", title)
    # Se a branch já existe no GitHub com o mesmo conteúdo, não faz nada
    existing = git(*auth, "ls-remote", remote, f"refs/heads/{branch}")
    if existing:
        git(*auth, "fetch", "-q", remote, f"refs/heads/{branch}:refs/remotes/origin/{branch}")
        if not git("diff", f"origin/{branch}", "HEAD", "--", app, check=False):
            log("    PR já atualizado; nada a fazer.")
            return
    git(*auth, "push", "-q", "--force", remote, f"HEAD:refs/heads/{branch}")
    owner = REPO.split("/")[0]
    prs = github("GET", f"/repos/{REPO}/pulls?state=open&head={owner}:{urllib.parse.quote(branch)}")
    if prs:
        github("PATCH", f"/repos/{REPO}/pulls/{prs[0]['number']}", {"title": title, "body": body})
        log(f"    PR atualizado: {prs[0]['html_url']}")
    else:
        pr = github("POST", f"/repos/{REPO}/pulls",
                    {"title": title, "body": body, "head": branch, "base": BASE})
        log(f"    PR aberto: {pr['html_url']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="só mostra o que seria atualizado")
    args = parser.parse_args()
    config = json.loads(CONFIG_FILE.read_text()) if CONFIG_FILE.exists() else {}
    if not args.dry_run:
        for var in ("GH_USER", "GH_TOKEN"):
            if not os.environ.get(var):
                log(f"Defina {var} para abrir PRs (ou use --dry-run).")
                return 2
    plans = []
    for app_dir in sorted(ROOT.glob("ruiz-*/")):
        log(f"{app_dir.name}:")
        plan = plan_app(app_dir, config)
        if plan:
            plans.append(plan)
            log(f"  {len(plan['changes'])} imagem(ns) para atualizar")
        else:
            log("  em dia")
    failures = 0
    for plan in plans:
        log(f"{plan['app']}:")
        try:
            publish(plan, args.dry_run)
        except (subprocess.CalledProcessError, urllib.error.HTTPError) as e:
            failures += 1
            detail = e.stderr if isinstance(e, subprocess.CalledProcessError) else e.read().decode()[:300]
            log(f"  ! falhou: {e} {detail}")
    if not args.dry_run and plans:
        git("checkout", "-q", "--detach", f"origin/{BASE}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
