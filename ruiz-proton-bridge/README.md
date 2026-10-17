# Proton Mail Bridge (Umbrel)

O [Proton Mail Bridge](https://github.com/ProtonMail/proton-bridge) compilado do código-fonte oficial, sem interface
gráfica, para usar a conta do Proton em clientes IMAP/SMTP, como o Apple Mail no iPhone e no iPad. O Proton não
publica imagem Docker oficial, e as imagens da comunidade costumam ficar desatualizadas.

## Como funciona

- `bridge/Dockerfile` compila o Bridge e o launcher oficiais na tag `BRIDGE_VERSION` e gera
  `caioruizz/ruiz-proton-bridge-bridge:<versão do app>`, construída pelo Jenkins da loja.
- O Bridge roda com a interface de linha de comando (`bridge --cli`) numa sessão `tmux`. Abrir o app no Umbrel
  mostra essa sessão num terminal web (ttyd), protegido pelo login do Umbrel.
- O Bridge só escuta em `127.0.0.1`; o `socat` publica o IMAP na porta **1143** e o SMTP na **1025** do Umbrel.
- A sessão do Proton fica no chaveiro `pass`, com uma chave GPG criada na primeira vez. Tudo (cofre do Bridge,
  cache local dos e-mails, chave e logs) fica em `data/bridge`.

## Atualizações

O Bridge se atualiza sozinho, sem precisar mexer no app:

1. O próprio Bridge baixa as atualizações do Proton e as instala em
   `data/bridge/.local/share/protonmail/bridge-v3/updates/<versão>`.
2. O app roda pelo launcher oficial (`proton-bridge`), que só usa uma atualização se a assinatura conferir com a
   chave do Proton (senão, apaga os arquivos) e se ela for mais nova que a versão da imagem.
3. A cada 15 minutos, `apply-updates.sh` verifica se há uma versão instalada mais nova que a que está rodando e,
   se houver, reinicia o Bridge (a interrupção dura segundos).
4. Se o Bridge falhar ao iniciar três vezes seguidas, `bridge-loop.sh` volta para a versão da imagem até o
   próximo reinício do app.

`BRIDGE_VERSION` só define a versão de partida de instalações novas; atualizá-lo é opcional.

## Certificado TLS (iPhone e iPad)

O certificado que o Bridge gera sozinho vale só para `127.0.0.1` e por 20 anos, e o iOS recusa os dois (o Bridge
registra `remote error: tls: unknown certificate`). Por isso `tls-setup.sh` mantém em `data/bridge/tls`:

- uma autoridade certificadora (CA) própria deste Umbrel, válida por 10 anos, que você instala nos aparelhos;
- um certificado de servidor assinado por ela, com 825 dias (limite do iOS), válido para os nomes do Umbrel
  (`BRIDGE_TLS_HOSTS`, por padrão o nome do Umbrel e `umbrel.local`) e para os nomes ou IPs listados em
  `data/bridge/tls/hosts.txt`. Ele é renovado sozinho 30 dias antes de vencer (ou quando a lista muda), sem trocar
  a CA, e o Bridge é reiniciado para usá-lo;
- uma página na porta **4834** (`http://<umbrel>:4834`) com o perfil do iPhone/iPad: CA + conta de e-mail
  (servidor, portas 1143/1025 e SSL). Só conteúdo público; o iOS pede e-mail, usuário e senha do Bridge.

O servidor do perfil é o primeiro nome de `hosts.txt` ou, se o arquivo estiver vazio, o nome do Umbrel (que
funciona pelo MagicDNS do Tailscale).

## Primeiro acesso

1. Abra o app e, no terminal, rode `login`. Informe o e-mail, a senha e o código de 2FA do Proton.
2. Espere a sincronização inicial (`info` mostra o andamento; caixas grandes levam alguns minutos).
3. Troque as portas para SSL, para o iOS sempre conectar com criptografia: `change imap-security` e
   `change smtp-security`, respondendo `yes`.
4. Passe a usar o certificado deste app: `cert import`, informando `/data/tls/server.pem` e
   `/data/tls/server-key.pem`. Depois rode `exit`; o Bridge reinicia sozinho em 5 segundos.
5. Rode `info` e anote o usuário e a **senha do Bridge** (diferente da senha do Proton) para configurar o cliente.

## Segurança

- Depois do comando `clear everything` (apaga todas as contas e configurações), reinicie o app no Umbrel.

- As portas 1143 e 1025 entregam os e-mails já descriptografados para quem tiver a senha do Bridge. Use-as só na
  rede local ou pelo Tailscale e **nunca** as encaminhe no roteador.
- A chave GPG do chaveiro é criada sem senha: quem protege a sessão do Proton é o acesso ao Umbrel e aos dados
  do app.
- O certificado TLS é o do próprio Bridge (autoassinado). Na primeira conexão de cada aparelho, confirme a
  confiança no certificado.

Requer um plano pago do Proton. Projeto independente, sem vínculo com a Proton AG.
