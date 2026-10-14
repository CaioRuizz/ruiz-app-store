# Jenkins (Umbrel)

Jenkins LTS para rodar CI/CD no Umbrel, com um daemon Docker isolado para os builds.

## O que vem pronto

- **Jenkins 2.580.1 LTS** (JDK 21), sem o assistente de instalação.
- **Plugins:** Pipeline, Pipeline Stage View, Git, GitHub Branch Source, Gitea, Docker Pipeline,
  Credentials Binding, Timestamper, Workspace Cleanup e Configuration as Code.
- **Docker isolado:** o serviço `docker` (Docker-in-Docker) roda ao lado do Jenkins e é o único Docker que
  os pipelines enxergam (`DOCKER_HOST=tcp://docker:2376`, com TLS). Um build pode criar, rodar e apagar
  containers sem afetar os apps do Umbrel. A CLI `docker` e o `buildx` já estão na imagem do Jenkins.

## Acesso

- Usuário `umbrel` e a senha que o Umbrel mostra na página do app.
- A senha e a segurança vêm de `jenkins/casc.yaml` (Configuration as Code) e são reaplicadas a cada início:
  troque a senha no Umbrel, não no Jenkins.
- O login do Umbrel fica desligado (`PROXY_AUTH_ADD: "false"`) porque o Jenkins tem login próprio e os webhooks
  do GitHub e do Gitea precisam chegar sem autenticação extra.

## Dados

Tudo fica em `${APP_DATA_DIR}/data`:

- `jenkins_home/`: jobs, histórico, credenciais e plugins instalados pela interface.
- `docker/`: imagens e cache do Docker dos builds.
- `docker-certs/`: certificados TLS gerados pelo serviço `docker` e lidos pelo Jenkins.

## Exemplo de pipeline

```groovy
pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        sh 'docker build -t meu-app .'
      }
    }
  }
}
```

## Imagem

`jenkins/Dockerfile` é publicado como `caioruizz/ruiz-jenkins-jenkins:<versão>` pelo workflow do repositório.
Para testar localmente fora do Umbrel:

```sh
docker build -t caioruizz/ruiz-jenkins-jenkins:1.0.0 jenkins
# rode só os serviços jenkins e docker do docker-compose.yml, com APP_DATA_DIR e APP_PASSWORD definidos
```
