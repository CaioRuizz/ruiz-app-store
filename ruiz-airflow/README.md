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

Na primeira vez, `hooks/airflow-ui/init.sh` gera em `data/config`:

- `fernet.key`: criptografa senhas de conexões e variáveis no banco. **Faça backup dela junto com o banco**: sem
  ela, as conexões salvas não podem ser lidas.
- `jwt.secret` e `api.secret`: assinam os tokens trocados entre os componentes e a sessão da interface.
- `airflow.cfg`: configuração editável. As variáveis `AIRFLOW__*` do `docker-compose.yml` têm precedência sobre
  ela. Depois de editar, reinicie o app.

## DAGs: tela "DAG bundles"

Em **Admin → DAG bundles** você define de onde o Airflow lê as DAGs, sem editar arquivos nem reiniciar o app
no Umbrel:

1. **Adicionar repositório Git**: nome, URL HTTP(S) de clone, usuário, token de leitura, branch, subpasta das
   DAGs (por exemplo `airflow/dags`) e intervalo de atualização. O token vai para uma conexão Git
   (`bundle_<nome>`, em Admin → Connections), criptografada com a chave Fernet.
2. **Testar acesso** confere URL, token e branch antes de salvar.
3. **Salvar** grava a configuração em `data/config/bundles.json`; **Aplicar e reiniciar** reinicia os componentes
   do Airflow em poucos segundos. A tela avisa se houver tarefas em execução, que seriam interrompidas.

Por padrão, as DAGs vêm da pasta `data/dags` (bundle `dags-folder`), que pode continuar junto com os
repositórios. Depois que a tela salva uma configuração, ela vale no lugar de `dag_bundle_config_list` do
`airflow.cfg`; para voltar a usar o arquivo, apague `data/config/bundles.json` e reinicie o app.

Um merge na branch configurada chega ao Airflow no intervalo de atualização, e cada execução registra o commit
das DAGs que usou.

### Como funciona

- A tela é um plugin do Airflow (`hooks/airflow-ui/ruiz_bundles.py` e `dag_bundles.html`), protegido pelo login
  do próprio Airflow e disponível só para quem pode editar conexões.
- Cada componente roda por `hooks/airflow-ui/run.sh`, que carrega `bundles.json` ao iniciar e encerra o processo
  quando a tela grava `data/config/restart-request`; o Docker o reinicia (`restart: on-failure`). Assim o app não
  precisa de acesso ao Docker do Umbrel.
- Os arquivos ficam em `hooks/` porque, nas atualizações, o Umbrel só copia o `docker-compose.yml`, os templates,
  o `exports.sh` e essa pasta. Nenhum deles tem nome de hook, então nada roda no host.

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

## Configuração do Docker isolado (`daemon.json`)

O Docker isolado lê `data/docker-config/daemon.json` ao iniciar, se o arquivo existir. A pasta fica nos dados
do app (`~/umbrel/app-data/ruiz-airflow/data/docker-config`) e sobrevive às atualizações. Exemplo, para aceitar um
registry HTTP da rede local:

```json
{ "insecure-registries": ["192.168.68.103:34947"] }
```

Depois de criar ou editar o arquivo, reinicie o app. Não use a chave `hosts`: o socket já é definido no
`docker-compose.yml`, e as duas configurações juntas impedem o Docker de iniciar. Um JSON inválido também
impede o início; confira com `docker logs`.
