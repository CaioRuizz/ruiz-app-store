# Proton Mail Bridge compilado do código-fonte oficial (github.com/ProtonMail/proton-bridge),
# sem interface gráfica, com um terminal web (ttyd) para o login e encaminhadores para as portas
# IMAP/SMTP. O Proton não publica imagem Docker oficial.
ARG BRIDGE_VERSION=v3.27.1

FROM golang:1.26.9-trixie AS build
ARG BRIDGE_VERSION
RUN apt-get update \
 && apt-get install -y --no-install-recommends libfido2-dev libcbor-dev libssl-dev libsecret-1-dev \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch "${BRIDGE_VERSION}" https://github.com/ProtonMail/proton-bridge.git . \
 && make build-nogui \
 && mkdir -p /out && install -m 0755 bridge proton-bridge /out/

# ttyd (terminal web): binário estático oficial (github.com/tsl0922/ttyd), conferido por SHA-256.
# O Debian 13 não tem mais o pacote.
FROM golang:1.26.9-trixie AS ttyd
ARG TARGETARCH
ARG TTYD_VERSION=1.7.7
RUN case "${TARGETARCH:-amd64}" in \
      amd64) arch=x86_64;  sum=8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55 ;; \
      arm64) arch=aarch64; sum=b38acadd89d1d396a0f5649aa52c539edbad07f4bc7348b27b4f4b7219dd4165 ;; \
      *) echo "Arquitetura sem suporte: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /ttyd "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${arch}" \
 && echo "${sum}  /ttyd" | sha256sum -c - \
 && chmod 0755 /ttyd

FROM debian:trixie-20261005-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates libfido2-1 libsecret-1-0 pass gnupg socat tmux tini procps \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --create-home --home-dir /home/bridge bridge
# proton-bridge é o launcher oficial: aplica as atualizações automáticas do Proton (assinadas, conferidas
# com a chave do Proton e guardadas em /data) e, sem atualização mais nova, roda o bridge da imagem.
COPY --from=build /out/bridge /out/proton-bridge /usr/local/bin/
COPY --from=ttyd /ttyd /usr/local/bin/ttyd
COPY start.sh bridge-loop.sh apply-updates.sh /usr/local/bin/
USER 1000:1000
# Tudo que o Bridge guarda (cofre, cache, chave GPG e cofre do "pass") fica em /data
ENV HOME=/data TERM=xterm-256color LANG=C.UTF-8
EXPOSE 7681 2143 2025
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/start.sh"]
