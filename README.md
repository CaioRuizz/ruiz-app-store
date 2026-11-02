## CI/CD

Os workflows de CI/CD estão em `.github/workflows/`:

- `build-publish.yml` roda em cada push para `master`. Para cada `ruiz-*/*/Dockerfile`, publica
  `caioruizz/<app>-<pasta>:<versão do umbrel-app.yml>` e `:latest` no Docker Hub e atualiza as tags das imagens da loja
  nos `docker-compose.yml`. Commits com `[skip ci]` no título não disparam o build. Configure os secrets
  `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN` no repositório.
- `image-updates.yml` verifica diariamente às 06:00 no horário de São Paulo (09:00 UTC) e também pode ser
  executado manualmente pela aba **Actions**. Ele atualiza ou abre PRs para novas versões de imagens de terceiros.
  O workflow usa o `GITHUB_TOKEN` com permissões de conteúdo e pull requests; habilite em **Settings → Actions →
  General** a opção **Allow GitHub Actions to create and approve pull requests**.

O `GITHUB_TOKEN` dos workflows não dispara novas execuções quando usado para enviar commits ou branches. A
atualização diária continua limitada às imagens e tags descritas em `image-updates.json`.

## Atualização automática das imagens

Todo dia às 06:00 no horário de São Paulo (e ao rodar manualmente o workflow na `master`), o GitHub Actions executa
`scripts/image_updates.py`, que faz o papel do Dependabot para as imagens Docker de terceiros:

- Lê as imagens fixadas por versão nos `docker-compose.yml` (`image:`) e `Dockerfile` (`FROM`) de cada app. Imagens
  flutuantes (`latest`, `alpine`, `node:24-alpine`) e as imagens da própria loja (`caioruizz/ruiz-*`) ficam de fora.
- Procura no Docker Hub a versão mais nova com o mesmo formato de tag (mesmo sufixo, como `-management` ou
  `-lts-jdk21`) e a **mesma versão maior**. Versões maiores novas só aparecem como aviso no PR, porque podem exigir
  migração (por exemplo, Postgres 17 → 18).
- Abre **um PR por app** na branch `deps/<app>`, com os tags novos, o README do app e a versão do `umbrel-app.yml`
  ajustados (a mesma da imagem principal, como no Redis, ou o patch seguinte). Se o PR já existe, é atualizado.
- Depois do merge, o build da `master` roda normalmente e o Umbrel passa a oferecer a atualização do app.

Ajustes em `image-updates.json`: `ignore` (imagens que não devem ser verificadas) e `allow_major` (imagens em que
versões maiores também viram PR). Para simular sem abrir PRs: `python3 scripts/image_updates.py --dry-run`.

## Umbrel Community App Store Template

This repository is a template to create an Umbrel Community App Store. These additional app stores allow developers to distribute applications without submitting to the [Official Umbrel App Store](https://github.com/getumbrel/umbrel-apps).

## How to use:

1. Start by clicking the "Use this template" button located above.
2. Assign an ID and name to your app store within the `umbrel-app-store.yml` file. This file specifies two important attributes:
    - `id` - Acts as a unique prefix for every app within your Community App Store. You must start your application's ID with your app store's ID. For instance, in this template, the app store ID is `sparkles`, and there's an app named `hello world`. Consequently, the app's ID should be: `sparkles-hello-world`.
    - `name` - This is the name of the Community App Store displayed in the umbrelOS UI.
3. Change the name of the `sparkles-hello-world` folder to match your app's ID. The app ID is for you to decide. For example, if your app store ID is `whistles`, and your app is named My Video Downloader, you could set its app ID to `whistles-my-video-downloader`, and rename the folder accordingly.
4. Next, enter your app's listing details in the `whistles-my-video-downloader/umbrel-app.yml`. These are displayed in the umbrelOS UI.
5. Include the necessary Docker services in `whistles-my-video-downloader/docker-compose.yml`.
6. That's it! Your Community App Store, featuring your unique app, is now set up and ready to go. To use your Community App Store, you can add its GitHub url the umbrelOS user interface as shown in the following demo:


https://user-images.githubusercontent.com/10330103/197889452-e5cd7e96-3233-4a09-b475-94b754adc7a3.mp4
