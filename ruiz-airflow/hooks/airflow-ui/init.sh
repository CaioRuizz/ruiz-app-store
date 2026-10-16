#!/usr/bin/env bash
# Roda uma vez a cada início do app, antes dos demais serviços do Airflow.
# 1. Gera as chaves (Fernet e JWT) na primeira vez e as guarda em data/config.
# 2. Cria um airflow.cfg mínimo, editável pelo usuário, se ainda não existir.
# 3. Migra o banco e cria o usuário admin com a senha do Umbrel (só na primeira vez:
#    se o usuário já existe, "airflow users create" falha e o entrypoint ignora).
set -euo pipefail

CONFIG_DIR=/opt/airflow/config
umask 077

if [[ ! -s "$CONFIG_DIR/fernet.key" ]]; then
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > "$CONFIG_DIR/fernet.key"
  echo "Chave Fernet criada."
fi

for name in jwt.secret api.secret; do
  if [[ ! -s "$CONFIG_DIR/$name" ]]; then
    python -c "import secrets; print(secrets.token_urlsafe(48))" > "$CONFIG_DIR/$name"
    echo "Segredo $name criado."
  fi
done

if [[ ! -f "$CONFIG_DIR/airflow.cfg" ]]; then
  umask 022
  cat > "$CONFIG_DIR/airflow.cfg" <<'CFG'
# Configuração do Airflow deste app. Variáveis AIRFLOW__* definidas no docker-compose.yml
# têm precedência sobre este arquivo. Depois de editar, reinicie o app no Umbrel.
# As origens das DAGs também podem ser configuradas pela tela Admin > DAG bundles; depois que
# ela salva uma configuração (data/config/bundles.json), essa passa a valer no lugar da linha abaixo.

[dag_processor]
# Por padrão as DAGs são lidas da pasta data/dags do app. Para ler de um repositório Git
# (Gitea, GitHub...), crie uma conexão do tipo "Git" na interface (Admin > Connections), com
# id "gitea_dags", a URL do repositório em "Repository URL" e um token de acesso em "Password",
# e troque a linha abaixo por:
# dag_bundle_config_list = [{"name": "gitea", "classpath": "airflow.providers.git.bundles.git.GitDagBundle", "kwargs": {"git_conn_id": "gitea_dags", "tracking_ref": "main", "refresh_interval": 60}}]
dag_bundle_config_list = [{"name": "dags-folder", "classpath": "airflow.dag_processing.bundles.local.LocalDagBundle", "kwargs": {}}]
CFG
  echo "airflow.cfg criado."
fi

exec /entrypoint airflow version
