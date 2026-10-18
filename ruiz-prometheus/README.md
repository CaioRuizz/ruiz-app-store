# Prometheus (Umbrel)

A imagem oficial do Prometheus (`prom/prometheus:v3.15.0`), guardando 90 dias de métricas, com o node-exporter
oficial (`prom/node-exporter:v1.12.1`) para as métricas do Umbrel.

- **Configuração:** `data/config/prometheus.yml`, criado na instalação e nunca sobrescrito nas atualizações. Tem
  exemplos comentados para RabbitMQ e Jenkins. Para aplicar sem reiniciar: `POST /-/reload` (protegido pelo login do
  Umbrel) ou reinicie o app.
- **Alvos no mesmo Umbrel:** os apps ficam na mesma rede, então use o nome do container (`<app>_<serviço>_1:<porta>`).
- **Grafana:** adicione uma fonte de dados Prometheus com a URL `http://ruiz-prometheus_prometheus_1:9090`.
- **Acesso:** a interface fica atrás do login do Umbrel; só a API de consulta (`/api/*`, somente leitura, com a API de
  administração desligada) é liberada para outras ferramentas.
- **node-exporter:** lê o sistema do Umbrel em modo somente leitura (`/` montado em `/host`, `pid: host`) e mede CPU,
  memória, disco e sistemas de arquivos. O tráfego de rede medido é o do container, não o do Umbrel.
- **Ícone:** logo do Prometheus (licença Apache 2.0), projeto da Cloud Native Computing Foundation.
