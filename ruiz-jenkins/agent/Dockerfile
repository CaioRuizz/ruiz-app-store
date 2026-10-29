# Agente de build do Jenkins: a imagem oficial jenkins/agent + Python 3 + CLI do Docker e buildx.
# A nuvem "dind" do Jenkins cria um container desta imagem por build, com o socket do Docker isolado
# do app montado em /var/run/docker.sock (nunca o Docker que roda os apps do Umbrel).
FROM jenkins/agent:3391.va_37fa_a_305d6d-8-jdk21

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl python3 \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
     > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
  && rm -rf /var/lib/apt/lists/*

USER jenkins
