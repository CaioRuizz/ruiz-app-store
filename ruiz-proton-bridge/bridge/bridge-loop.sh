#!/usr/bin/env bash
# Mantém o Bridge rodando na sessão tmux; se ele encerrar (por exemplo, com "exit"), volta em 5 s.
while true; do
  # O terminal mostra só avisos e erros; o log completo fica em
  # /data/.local/share/protonmail/bridge-v3/logs (pasta data/bridge do app)
  bridge --cli
  echo
  echo "O Bridge encerrou. Reiniciando em 5 segundos..."
  sleep 5
done
