# Redis (Umbrel)

A imagem oficial do Redis (`redis:8.10.2`), com persistência AOF + snapshots, e o Redis Insight como interface web.

- **Conexão dos projetos:** porta **6379** do Umbrel, usuário `default` e a senha que o Umbrel mostra para o app
  (`redis://default:<senha>@umbrel.local:6379`). Só na rede local e no Tailscale; não encaminhe a porta no roteador.
- **Redis Insight:** na primeira abertura, aceite os termos e adicione o banco: host `redis`, porta `6379`,
  usuário `default` e a mesma senha. Fica atrás do login do Umbrel, porque não tem login próprio.
- **Dados:** `data/redis` (AOF e `dump.rdb`). O Redis roda com o usuário 1000, dono dos dados do Umbrel.
- **Mesmo Umbrel:** outros apps alcançam o Redis pelo nome do container, `ruiz-redis_redis_1:6379`.
