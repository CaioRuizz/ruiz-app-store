# Configuração do OpenBao deste app. Criada na instalação e nunca sobrescrita nas atualizações;
# depois de editar, reinicie o app.

ui            = true
# Com o armazenamento integrado (Raft), a recomendação do OpenBao é desligar o mlock
disable_mlock = true

storage "raft" {
  path    = "/openbao/data"
  node_id = "umbrel"
}

# HTTP sem TLS: o acesso chega pelo proxy do Umbrel na rede local ou pelo Tailscale (criptografado).
# Não exponha a porta na internet.
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr     = "http://ruiz-openbao_openbao_1:8200"
cluster_addr = "http://127.0.0.1:8201"
