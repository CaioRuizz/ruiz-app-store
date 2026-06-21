FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openssh-server \
        sudo \
        ttyd \
        util-linux && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /run/sshd

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
