#!/usr/bin/env bash
# Inicia um componente do Airflow (api-server, scheduler, dag-processor ou triggerer).
#
# - Se a tela "DAG bundles" já salvou uma configuração (data/config/bundles.json), ela vale no
#   lugar de dag_bundle_config_list do airflow.cfg.
# - Quando a tela pede para aplicar (grava data/config/restart-request), o componente encerra com
#   código 3 e o Docker o reinicia (restart: on-failure), já lendo a configuração nova. Assim o app
#   não precisa de acesso ao Docker do Umbrel.
set -u

CONFIG_DIR=/opt/airflow/config
BUNDLES_FILE="$CONFIG_DIR/bundles.json"
RESTART_FILE="$CONFIG_DIR/restart-request"

if [[ -s "$BUNDLES_FILE" ]]; then
  AIRFLOW__DAG_PROCESSOR__DAG_BUNDLE_CONFIG_LIST="$(cat "$BUNDLES_FILE")"
  export AIRFLOW__DAG_PROCESSOR__DAG_BUNDLE_CONFIG_LIST
fi

restart_stamp() { cat "$RESTART_FILE" 2>/dev/null || true; }
started_with="$(restart_stamp)"

airflow "$@" &
child=$!

stop_child() {
  kill -TERM "$child" 2>/dev/null
  wait "$child"
}
trap 'stop_child; exit $?' TERM INT

while kill -0 "$child" 2>/dev/null; do
  sleep 3
  if [[ "$(restart_stamp)" != "$started_with" ]]; then
    echo "Configuração alterada na tela DAG bundles; reiniciando $1."
    stop_child
    exit 3
  fi
done

wait "$child"
exit $?
