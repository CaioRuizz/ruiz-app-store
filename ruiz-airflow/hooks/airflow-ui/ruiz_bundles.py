"""Tela "DAG bundles": configura de onde o Airflow lê as DAGs, sem editar o airflow.cfg.

A configuração salva fica em data/config/bundles.json, no mesmo formato de
[dag_processor] dag_bundle_config_list. O run.sh de cada componente a carrega ao iniciar, e
"Aplicar" grava data/config/restart-request para os componentes reiniciarem sozinhos.
Os tokens dos repositórios ficam nas Connections do Airflow (criptografados com a chave Fernet).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from airflow.api_fastapi.app import get_auth_manager
from airflow.api_fastapi.core_api.security import get_user
from airflow.configuration import conf
from airflow.models.connection import Connection
from airflow.models.taskinstance import TaskInstance
from airflow.plugins_manager import AirflowPlugin
from airflow.utils.session import create_session
from airflow.utils.state import TaskInstanceState

CONFIG_DIR = Path(os.environ.get("RUIZ_AIRFLOW_CONFIG_DIR", "/opt/airflow/config"))
BUNDLES_FILE = CONFIG_DIR / "bundles.json"
RESTART_FILE = CONFIG_DIR / "restart-request"
PAGE_FILE = Path(__file__).with_name("dag_bundles.html")

GIT_CLASSPATH = "airflow.providers.git.bundles.git.GitDagBundle"
LOCAL_CLASSPATH = "airflow.dag_processing.bundles.local.LocalDagBundle"
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


# ---------------------------------------------------------------------------
# Autorização: mesmo login da interface do Airflow (cookie _token ou Bearer), e só quem pode
# editar conexões pode mexer aqui.
def require_admin(request: Request, user=Depends(get_user)):
    if not get_auth_manager().is_authorized_connection(method="PUT", user=user):
        raise HTTPException(status_code=403, detail="Sem permissão para editar conexões.")
    # Escritas só via fetch da própria página (bloqueia formulários de outros sites)
    if request.method != "GET" and request.headers.get("x-requested-with") != "dag-bundles":
        raise HTTPException(status_code=400, detail="Cabeçalho X-Requested-With ausente.")
    return user


class Bundle(BaseModel):
    name: str
    type: str = "git"  # git | local | other
    repo_url: str = ""
    username: str = ""
    token: str = ""  # só escrita; vazio mantém o token salvo
    has_token: bool = False
    conn_id: str = ""
    branch: str = "main"
    subdir: str = ""
    refresh_interval: int = 60
    path: str = ""
    raw: dict | None = None  # bundles de outros tipos, preservados como estão


class SavePayload(BaseModel):
    bundles: list[Bundle] = Field(default_factory=list)


class TestPayload(BaseModel):
    repo_url: str
    username: str = ""
    token: str = ""
    conn_id: str = ""
    branch: str = "main"


# ---------------------------------------------------------------------------
def _applied_list() -> list[dict]:
    """Configuração com que este processo iniciou (o que está valendo agora)."""
    raw = conf.get("dag_processor", "dag_bundle_config_list", fallback="[]")
    return json.loads(raw) if raw.strip() else []


def _saved_list() -> list[dict] | None:
    if BUNDLES_FILE.is_file() and BUNDLES_FILE.stat().st_size:
        return json.loads(BUNDLES_FILE.read_text())
    return None


def _canonical(items: list[dict]) -> str:
    return json.dumps(items, sort_keys=True)


def _to_ui(entry: dict, connections: dict[str, Connection]) -> Bundle:
    kwargs = entry.get("kwargs") or {}
    classpath = entry.get("classpath", "")
    if classpath == GIT_CLASSPATH:
        conn = connections.get(kwargs.get("git_conn_id", ""))
        return Bundle(
            name=entry["name"],
            type="git",
            conn_id=kwargs.get("git_conn_id", ""),
            repo_url=(conn.host if conn else None) or kwargs.get("repo_url", ""),
            username=(conn.login if conn else "") or "",
            has_token=bool(conn and conn.password),
            branch=kwargs.get("tracking_ref", "main"),
            subdir=kwargs.get("subdir") or "",
            refresh_interval=int(kwargs.get("refresh_interval", 300) or 0),
        )
    if classpath == LOCAL_CLASSPATH:
        return Bundle(name=entry["name"], type="local", path=kwargs.get("path") or "",
                      refresh_interval=int(kwargs.get("refresh_interval", 0) or 0))
    return Bundle(name=entry.get("name", "?"), type="other", raw=entry)


def _mask(text: str, secret: str) -> str:
    return text.replace(secret, "***") if secret else text


def _auth_url(repo_url: str, username: str, token: str) -> str:
    parts = urlsplit(repo_url)
    if not token or parts.scheme not in ("http", "https"):
        return repo_url
    netloc = f"{quote(username or 'git', safe='')}:{quote(token, safe='')}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


# ---------------------------------------------------------------------------
app = FastAPI(title="DAG bundles", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/", response_class=HTMLResponse)
def page(_user=Depends(require_admin)):
    return HTMLResponse(PAGE_FILE.read_text(encoding="utf-8"), headers={"Cache-Control": "no-store"})


@app.get("/api/state")
def state(_user=Depends(require_admin)):
    saved = _saved_list()
    applied = _applied_list()
    current = saved if saved is not None else applied
    with create_session() as session:
        conn_ids = [e.get("kwargs", {}).get("git_conn_id") for e in current]
        conns = {c.conn_id: c for c in session.scalars(
            select(Connection).where(Connection.conn_id.in_([c for c in conn_ids if c])))}
        active = session.scalar(
            select(func.count()).select_from(TaskInstance).where(
                TaskInstance.state.in_([TaskInstanceState.RUNNING, TaskInstanceState.QUEUED])))
        bundles = [_to_ui(e, conns).model_dump(exclude={"token"}) for e in current]
    return {
        "bundles": bundles,
        "source": "tela" if saved is not None else "airflow.cfg",
        "pending": saved is not None and _canonical(saved) != _canonical(applied),
        "active_tasks": active,
    }


@app.post("/api/test")
def test_repo(payload: TestPayload, _user=Depends(require_admin)):
    token, username = payload.token, payload.username
    if not token and payload.conn_id:
        with create_session() as session:
            conn = session.scalar(select(Connection).where(Connection.conn_id == payload.conn_id))
            if conn:
                token = conn.password or ""
                username = username or conn.login or ""
    branch = payload.branch.strip() or "main"
    url = _auth_url(payload.repo_url.strip(), username, token)
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/true"}
    try:
        result = subprocess.run(["git", "ls-remote", "--heads", url, branch],
                                capture_output=True, text=True, timeout=20, env=env)
    except subprocess.TimeoutExpired:
        return {"ok": False, "message": "O repositório não respondeu em 20 segundos. Confira a URL e a rede."}
    if result.returncode != 0:
        detail = _mask(result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "erro desconhecido", token)
        return {"ok": False, "message": f"Não consegui acessar o repositório: {detail}"}
    if f"refs/heads/{branch}" not in result.stdout:
        return {"ok": False, "message": f"Acessei o repositório, mas a branch “{branch}” não existe."}
    return {"ok": True, "message": f"Acesso confirmado e branch “{branch}” encontrada."}


@app.post("/api/save")
def save(payload: SavePayload, _user=Depends(require_admin)):
    seen: set[str] = set()
    entries: list[dict] = []
    with create_session() as session:
        for b in payload.bundles:
            name = b.name.strip()
            if not NAME_RE.match(name):
                raise HTTPException(400, f"Nome inválido: “{name}”. Use letras minúsculas, números, - e _.")
            if name in seen:
                raise HTTPException(400, f"Nome repetido: “{name}”.")
            seen.add(name)

            if b.type == "other" and b.raw:
                entries.append(b.raw)
            elif b.type == "local":
                kwargs: dict = {}
                if b.path.strip():
                    kwargs["path"] = b.path.strip()
                entries.append({"name": name, "classpath": LOCAL_CLASSPATH, "kwargs": kwargs})
            elif b.type == "git":
                if urlsplit(b.repo_url.strip()).scheme not in ("http", "https"):
                    raise HTTPException(400, f"“{name}”: informe a URL HTTP(S) de clone do repositório.")
                subdir = b.subdir.strip().strip("/")
                if ".." in subdir.split("/"):
                    raise HTTPException(400, f"“{name}”: a subpasta não pode conter “..”.")
                conn_id = b.conn_id.strip() or f"bundle_{name}"
                conn = session.scalar(select(Connection).where(Connection.conn_id == conn_id))
                if conn is None:
                    conn = Connection(conn_id=conn_id, conn_type="git")
                    session.add(conn)
                conn.conn_type = "git"
                conn.host = b.repo_url.strip()
                conn.login = b.username.strip() or None
                if b.token:
                    conn.password = b.token
                conn.description = f"Repositório de DAGs do bundle {name} (tela DAG bundles)"
                kwargs = {"git_conn_id": conn_id, "tracking_ref": b.branch.strip() or "main",
                          "refresh_interval": max(int(b.refresh_interval), 0)}
                if subdir:
                    kwargs["subdir"] = subdir
                entries.append({"name": name, "classpath": GIT_CLASSPATH, "kwargs": kwargs})
            else:
                raise HTTPException(400, f"Tipo desconhecido para “{name}”.")

    if not entries:
        raise HTTPException(400, "Mantenha pelo menos uma origem de DAGs.")
    tmp = BUNDLES_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(BUNDLES_FILE)
    return state()


@app.post("/api/apply")
def apply(_user=Depends(require_admin)):
    RESTART_FILE.write_text(str(time.time_ns()))
    return {"ok": True}


class RuizBundlesPlugin(AirflowPlugin):
    name = "ruiz_dag_bundles"
    fastapi_apps = [{"app": app, "url_prefix": "/ruiz-bundles", "name": "DAG bundles"}]
    external_views = [{
        "name": "DAG bundles",
        "href": "/ruiz-bundles/",
        "url_route": "dag-bundles",
        "destination": "nav",
        "category": "admin",
    }]
