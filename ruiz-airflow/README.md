# Airflow (Umbrel)

A imagem oficial do Apache Airflow 3 (`apache/airflow:3.3.2-python3.12`), sem customização, com PostgreSQL 17
para os metadados, `LocalExecutor` e um daemon Docker isolado para as tarefas que rodam em containers.

## Serviços

| Serviço | Função |
| --- | --- |
| `postgres` | Banco de metadados do Airflow (`data/postgres`) |
| `init` | Roda a cada início e encerra: gera as chaves, migra o banco e cria o admin |
| `api-server` | Interface web e API REST (porta 4832 no Umbrel) |
| `scheduler` | Agenda as DAGs e executa as tarefas (`LocalExecutor`) |
| `dag-processor` | Lê e processa os arquivos de DAG |
| `triggerer` | Executa as tarefas *deferrable* (sensores assíncronos) |
| `docker` | Docker isolado para o `DockerOperator` |

## Primeiro acesso

Entre com o usuário `admin` e a senha que o Umbrel mostra na página do app. O `init` cria o usuário só se ele
ainda não existir: se você trocar a senha depois, no próprio Airflow, ela continua valendo.

O login do Umbrel fica desligado (`PROXY_AUTH_ADD: "false"`) porque o Airflow tem login próprio e a API REST
precisa ser acessível por scripts e pelo Jenkins.

## Configuração e chaves

Na primeira vez, `scripts/init.sh` gera em `data/config`:

- `fernet.key`: criptografa senhas de conexões e variáveis no banco. **Faça backup dela junto com o banco**: sem
  ela, as conexões salvas não podem ser lidas.
- `jwt.secret` e `api.secret`: assinam os tokens trocados entre os componentes e a sessão da interface.
- `airflow.cfg`: configuração editável. As variáveis `AIRFLOW__*` do `docker-compose.yml` têm precedência sobre
  ela. Depois de editar, reinicie o app.

## DAGs

Por padrão as DAGs são lidas de `data/dags`. Para lê-las de um repositório Git (Gitea, GitHub…):

1. Em **Admin → Connections**, crie uma conexão do tipo **Git** com id `gitea_dags`, a URL do repositório em
   **Repository URL** e um token de acesso de leitura em **Password**. O token fica criptografado com a chave
   Fernet.
2. Em `data/config/airflow.cfg`, troque `dag_bundle_config_list` pela linha comentada no próprio arquivo
   (`GitDagBundle`, branch `main`, atualização a cada 60 segundos).
3. Reinicie o app.

Cada execução registra a versão (commit) das DAGs usada, e um merge na `main` passa a valer em até um minuto.

## Tarefas em containers

O serviço `docker` só aceita conexões pelo socket `/var/run/dind/docker.sock`, compartilhado com os componentes
do Airflow. A variável `DOCKER_HOST` aponta para ele, então o `DockerOperator` usa o Docker isolado sem nenhuma
configuração na DAG:

```python
from airflow.providers.docker.operators.docker import DockerOperator

DockerOperator(
    task_id="coleta",
    image="ghcr.io/usuario/pipeline:1.0.0",
    command="python coleta.py",
    mount_tmp_dir=False,  # o Docker isolado não enxerga as pastas do Airflow
    auto_remove="success",
)
```

Assim cada pipeline traz as próprias dependências na imagem, sem instalar pacotes no Airflow, e não tem acesso ao
Docker que roda os apps do Umbrel.

## Ícone

O ícone é o logo do Apache Airflow, extraído de
[`apache/airflow`](https://github.com/apache/airflow/blob/main/airflow-core/src/airflow/ui/src/assets/AirflowPin.tsx)
(licença Apache 2.0). Apache Airflow e o logo são marcas da Apache Software Foundation.
