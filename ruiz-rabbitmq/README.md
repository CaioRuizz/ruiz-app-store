# RabbitMQ (Umbrel)

A imagem oficial do RabbitMQ com o plugin de gerenciamento (`rabbitmq:4.3.6-management`).

- **Interface web:** usuário `admin` e a senha que o Umbrel mostra para o app, aplicada só na primeira
  inicialização (trocar depois, no painel, continua valendo). O login do Umbrel fica desligado porque o painel tem
  login próprio e a API HTTP precisa ser acessível por scripts.
- **Conexão dos projetos:** AMQP na porta **5672** do Umbrel (`amqp://<usuário>:<senha>@umbrel.local:5672/<vhost>`).
  Crie um usuário e um vhost por projeto no painel. Só na rede local e no Tailscale; não encaminhe a porta.
- **Mesmo Umbrel:** outros apps alcançam o broker por `ruiz-rabbitmq_rabbitmq_1:5672`.
- **Métricas:** o plugin `rabbitmq_prometheus` já vem ativo em `ruiz-rabbitmq_rabbitmq_1:15692` (há um exemplo
  pronto no `prometheus.yml` do app Prometheus).
- **Dados:** `data/rabbitmq`. O `hostname` fixo (`ruiz-rabbitmq`) é necessário: o RabbitMQ guarda os dados em
  `mnesia/rabbit@<hostname>`, e um nome que mudasse a cada recriação do container "perderia" filas e usuários.
