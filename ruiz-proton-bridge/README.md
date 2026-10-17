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

## Primeiro acesso

1. Abra o app e, no terminal, rode `login`. Informe o e-mail, a senha e o código de 2FA do Proton.
2. Espere a sincronização inicial (`info` mostra o andamento; caixas grandes levam alguns minutos).
3. Troque as portas para SSL, para o iOS sempre conectar com criptografia: `change imap-security` e
   `change smtp-security`, respondendo `yes`.
4. Rode `info` e anote o usuário e a **senha do Bridge** (diferente da senha do Proton) para configurar o cliente.

## Segurança

- Depois do comando `clear everything` (apaga todas as contas e configurações), reinicie o app no Umbrel.

- As portas 1143 e 1025 entregam os e-mails já descriptografados para quem tiver a senha do Bridge. Use-as só na
  rede local ou pelo Tailscale e **nunca** as encaminhe no roteador.
- A chave GPG do chaveiro é criada sem senha: quem protege a sessão do Proton é o acesso ao Umbrel e aos dados
  do app.
- O certificado TLS é o do próprio Bridge (autoassinado). Na primeira conexão de cada aparelho, confirme a
  confiança no certificado.

Requer um plano pago do Proton. Projeto independente, sem vínculo com a Proton AG.
