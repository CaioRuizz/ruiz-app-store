#!/usr/bin/env bash
# Prepara o chaveiro, inicia o Bridge numa sessão tmux e publica o terminal web.
set -euo pipefail

mkdir -p "$HOME"
chmod 700 "$HOME"

# O Bridge guarda a sessão do Proton no "pass", que exige uma chave GPG. A chave é criada sem senha
# na primeira vez: quem protege os dados é o acesso ao Umbrel.
if ! gpg --list-secret-keys "ProtonMail Bridge" >/dev/null 2>&1; then
  echo "Criando a chave GPG do chaveiro..."
  gpg --batch --passphrase '' --quick-gen-key "ProtonMail Bridge" default default never
fi
if [[ ! -f "$HOME/.password-store/.gpg-id" ]]; then
  pass init "ProtonMail Bridge"
fi

# O Bridge só escuta em 127.0.0.1; o socat expõe as portas para fora do container.
# IMAP 1143 -> 2143 e SMTP 1025 -> 2025 (o docker-compose mapeia para 1143 e 1025 no Umbrel).
socat TCP-LISTEN:2143,fork,reuseaddr TCP:127.0.0.1:1143 &
socat TCP-LISTEN:2025,fork,reuseaddr TCP:127.0.0.1:1025 &

tmux kill-session -t bridge 2>/dev/null || true
tmux new-session -d -s bridge -x 200 -y 50 /usr/local/bin/bridge-loop.sh
tmux set-option -t bridge status off

# Terminal web: cada aba do navegador se conecta à mesma sessão do Bridge.
exec ttyd --writable --port 7681 --max-clients 3 \
  --client-option titleFixed="Proton Mail Bridge" --client-option fontSize=15 \
  tmux attach-session -t bridge
