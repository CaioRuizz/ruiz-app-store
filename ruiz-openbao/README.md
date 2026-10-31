# OpenBao (Umbrel)

A imagem oficial do [OpenBao](https://openbao.org) (`openbao/openbao:2.7.2`), o fork aberto do HashiCorp Vault, com
armazenamento integrado (Raft) e interface web. Serve para segredos que os seus serviços buscam pela API.

## Primeiro acesso

1. Abra o app. A interface pede para **inicializar**: escolha o número de chaves e o limite (por exemplo, 3 e 2).
2. Ela mostra **uma única vez** as chaves de desselagem e o **root token**. Guarde tudo no seu gerenciador de senhas.
3. Dessele com as chaves (quantas o limite pedir) e entre com o root token.

## Selagem e reinícios

A cada reinício (do app ou do Umbrel), o OpenBao volta **selado**: os dados ficam criptografados e nada é lido até
você desselar pela interface com as chaves.

Desselagem automática (opcional): coloque as chaves em `data/unseal/unseal-keys` (uma por linha, quantas o limite
exigir) e o serviço `unsealer` as aplica sempre que o OpenBao estiver selado. É mais cômodo, mas quem tiver acesso
aos dados do app (ou ao backup deles) passa a conseguir abrir o cofre. Se usar, proteja o backup.

## Uso pelos seus serviços

- API: `http://umbrel.local:4836` ou, de outros apps do Umbrel, `http://ruiz-openbao_openbao_1:8200`.
- Para sistemas, prefira **AppRole** com uma policy por projeto, que dá acesso só aos caminhos dele. Use o root token
  só para administrar.
- O Jenkins tem o plugin **HashiCorp Vault**, e o Airflow tem o provider `hashicorp` (já vem na imagem oficial), que
  também funciona como *secrets backend* para Connections e Variables. Ambos são compatíveis com o OpenBao.

## Rede

HTTP sem TLS, como os outros apps: o acesso é pela rede local ou pelo Tailscale (criptografado). Não exponha a porta
na internet. A configuração fica em `data/config/config.hcl`, criada na instalação e nunca sobrescrita.
