# Jenkins (Umbrel)

A imagem oficial do Jenkins LTS (`jenkins/jenkins:2.580.1-lts-jdk21`), sem customização, mais um daemon
Docker isolado para os builds.

## Primeiro acesso

1. Abra o app. O Jenkins mostra o assistente de instalação.
2. A senha inicial aparece nos logs do app e fica em
   `${APP_DATA_DIR}/data/jenkins_home/secrets/initialAdminPassword`.
3. Instale os plugins sugeridos e crie o seu usuário administrador.

O login do Umbrel fica desligado (`PROXY_AUTH_ADD: "false"`) porque o Jenkins tem login próprio e os webhooks
do GitHub e do Gitea precisam chegar sem autenticação extra.

## Docker para os pipelines

O serviço `docker` (Docker-in-Docker) roda ao lado do Jenkins e só aceita conexões pelo socket
`/var/run/dind/docker.sock`, compartilhado com o Jenkins. Não abre porta de rede e não tem acesso ao Docker
que roda os apps do Umbrel: um build pode criar, rodar e apagar containers sem afetar mais nada.

Como a imagem oficial não traz a CLI `docker`, os builds usam o Docker por meio de agentes:

1. Instale o plugin **Docker** (Gerenciar Jenkins → Plugins).
2. Em **Gerenciar Jenkins → Clouds → New cloud → Docker**, use o Docker Host URI
   `unix:///var/run/dind/docker.sock` e clique em **Test Connection**.
3. Crie um **Docker Agent template** com um label (por exemplo `docker`) e uma imagem de agente, como
   `jenkins/agent:latest-jdk21`, com o método de conexão **Attach Docker container**.
4. Nos pipelines, use `agent { label 'docker' }`. Cada build roda num container novo dentro do Docker isolado.

## Dados

Tudo fica em `${APP_DATA_DIR}/data`:

- `jenkins_home/`: jobs, histórico, credenciais e plugins.
- `docker/`: imagens, containers e cache do Docker dos builds.
- `docker-socket/`: o socket do Docker isolado (recriado a cada início).

## Atualizações

As versões do Jenkins e do Docker estão fixadas em `docker-compose.yml`. Para atualizar, troque as tags e
suba a versão em `umbrel-app.yml`.

## Ícone

Logo oficial do Jenkins, de [jenkins.io/artwork](https://www.jenkins.io/artwork/), sob a licença
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Foi apenas centralizado num fundo branco
quadrado para o Umbrel.
