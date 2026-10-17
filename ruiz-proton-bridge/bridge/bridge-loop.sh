#!/usr/bin/env bash
# Mantém o Bridge rodando na sessão tmux.
#
# Roda pelo launcher oficial (proton-bridge), que usa a versão mais nova entre a da imagem e as
# atualizações automáticas que o próprio Bridge baixa do Proton. Se o Bridge encerrar, volta em 5 s.
# Proteção: se ele cair logo depois de iniciar três vezes seguidas (por exemplo, uma atualização que
# não roda neste container), o app passa a usar a versão da imagem até o próximo reinício do app.
# O terminal mostra só avisos e erros; o log completo fica em
# /data/.local/share/protonmail/bridge-v3/logs (pasta data/bridge do app).

quick_failures=0
use_image_version=false

while true; do
  started=$(date +%s)
  if $use_image_version; then
    bridge --cli
  else
    proton-bridge --cli
  fi
  status=$?

  if (( $(date +%s) - started < 60 )) && (( status != 0 )); then
    quick_failures=$((quick_failures + 1))
  else
    quick_failures=0
  fi

  if ! $use_image_version && (( quick_failures >= 3 )); then
    use_image_version=true
    echo
    echo "O Bridge falhou ao iniciar 3 vezes seguidas. Usando a versão da imagem ($(bridge --version 2>/dev/null | head -1))."
    echo "A versão atualizada fica em data/bridge/.local/share/protonmail/bridge-v3/updates."
  fi

  echo
  echo "O Bridge encerrou (código $status). Reiniciando em 5 segundos..."
  sleep 5
done
