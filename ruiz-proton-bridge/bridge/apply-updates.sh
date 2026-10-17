#!/usr/bin/env bash
# Aplica as atualizações automáticas do Bridge sem precisar reiniciar o app.
#
# No modo de linha de comando, o Bridge baixa e instala a atualização (assinada pelo Proton) em
# updates/<versão>, mas só passa a usá-la quando reinicia. A cada 15 minutos este script compara a
# versão instalada mais nova com a que está rodando e, se houver uma mais nova, encerra o Bridge;
# o bridge-loop.sh o inicia de novo pelo launcher, já na versão nova. A interrupção dura segundos.
# Também renova o certificado TLS perto do vencimento (tls-setup.sh) e reinicia o Bridge para usá-lo.
UPDATES_DIR="$HOME/.local/share/protonmail/bridge-v3/updates"
SERVER_CERT="$HOME/tls/server.pem"

running_version() {
  local pid exe
  pid=$(pgrep -x bridge | head -1) || return 1
  exe=$(readlink "/proc/$pid/exe") || return 1
  case "$exe" in
    "$UPDATES_DIR"/*) basename "$(dirname "$exe")" ;;
    *) "$exe" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 ;;
  esac
}

while true; do
  sleep "${APPLY_UPDATES_INTERVAL:-900}"

  cert_before=$(stat -c %Y "$SERVER_CERT" 2>/dev/null || echo 0)
  /usr/local/bin/tls-setup.sh >/dev/null || true
  if [[ "$(stat -c %Y "$SERVER_CERT" 2>/dev/null || echo 0)" != "$cert_before" ]]; then
    echo "$(date '+%F %T') Certificado TLS renovado; reiniciando o Bridge."
    pkill -TERM -x bridge || true
    continue
  fi

  [[ -d "$UPDATES_DIR" ]] || continue
  newest=$(find "$UPDATES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
             | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
  current=$(running_version) || continue
  [[ -n "$newest" && -n "$current" && "$newest" != "$current" ]] || continue
  if [[ "$(printf '%s\n%s\n' "$current" "$newest" | sort -V | tail -1)" == "$newest" ]]; then
    tmux display-message -t bridge "Aplicando a atualização do Bridge $newest" 2>/dev/null || true
    echo "$(date '+%F %T') Atualização $current -> $newest instalada; reiniciando o Bridge."
    pkill -TERM -x bridge || true
  fi
done
