## CI/CD

O build das imagens roda no Jenkins (http://100.92.14.38:4831, job `github/ruiz-app-store`), definido no
`Jenkinsfile` da raiz: para cada `ruiz-*/*/Dockerfile`, gera `caioruizz/<app>-<pasta>:<versão do umbrel-app.yml>`
e `:latest`, publica no Docker Hub e atualiza as tags das imagens desta loja nos `docker-compose.yml`. Commits
com `[skip ci]` no título não disparam build. O Jenkins consulta o GitHub a cada 5 minutos.

## Atualização automática das imagens

Todo dia de madrugada (e ao rodar o job manualmente na `master`), o Jenkins executa `scripts/image_updates.py`, que faz
o papel do Dependabot para as imagens Docker de terceiros:

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

O token da credencial `github` do Jenkins precisa da permissão **Pull requests: Read and write**, além de Contents.

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
