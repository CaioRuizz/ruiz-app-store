#!/usr/bin/env bash
# Certificado TLS para o IMAP/SMTP do Bridge que o iOS aceita.
#
# O certificado que o Bridge gera sozinho vale só para 127.0.0.1 e por 20 anos; o iOS recusa os dois
# (nome diferente do servidor e validade acima de 825 dias). Este script mantém em /data/tls:
#   ca.pem / ca-key.pem          autoridade certificadora deste Umbrel (10 anos), instalada nos aparelhos
#   server.pem / server-key.pem  certificado do servidor (825 dias), assinado pela CA e válido para os
#                                nomes em BRIDGE_TLS_HOSTS; renovado sozinho perto do vencimento ou
#                                quando a lista de nomes muda (a CA não muda, os aparelhos continuam
#                                confiando)
#   public/                      só conteúdo público: ca.pem e o perfil do iOS (CA + conta de e-mail)
# Para o Bridge usar o certificado, rode uma vez no terminal: cert import (veja o README).
set -euo pipefail

TLS_DIR="$HOME/tls"
PUBLIC_DIR="$TLS_DIR/public"
mkdir -p "$PUBLIC_DIR"
chmod 700 "$TLS_DIR"

# Nomes extras (um por linha) em data/bridge/tls/hosts.txt, por exemplo o IP do Tailscale do Umbrel.
# O primeiro nome desse arquivo passa a ser o servidor do perfil do iOS.
EXTRA_HOSTS="$(grep -vE '^\s*(#|$)' "$TLS_DIR/hosts.txt" 2>/dev/null | tr -s ' \t\r' '\n' | xargs || true)"
HOSTS="$EXTRA_HOSTS ${BRIDGE_TLS_HOSTS:-}"
PROFILE_HOST="$(awk '{print $1}' <<<"$EXTRA_HOSTS")"
if [[ ! -f "$TLS_DIR/hosts.txt" ]]; then
  printf '%s\n' "# Nomes ou IPs extras para o certificado, um por linha (por exemplo, o IP do Tailscale do Umbrel)." \
    "# O primeiro passa a ser o servidor do perfil do iOS. Depois de editar, reinicie o app." > "$TLS_DIR/hosts.txt"
fi

# Nomes do certificado: os informados e sempre 127.0.0.1/localhost
san="DNS:localhost,IP:127.0.0.1"
for h in $HOSTS; do
  if [[ "$h" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then san+=",IP:$h"; else san+=",DNS:$h"; fi
done
[[ -n "$PROFILE_HOST" ]] || PROFILE_HOST="$(awk '{print $1}' <<<"$HOSTS")"
[[ -n "$PROFILE_HOST" ]] || PROFILE_HOST="127.0.0.1"

if [[ ! -s "$TLS_DIR/ca.pem" || ! -s "$TLS_DIR/ca-key.pem" ]]; then
  echo "Criando a autoridade certificadora deste Umbrel..."
  openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 \
    -keyout "$TLS_DIR/ca-key.pem" -out "$TLS_DIR/ca.pem" \
    -subj "/O=Umbrel/CN=Proton Mail Bridge CA ($(hostname))" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
  rm -f "$TLS_DIR/server.pem"
fi

needs_server=false
if [[ ! -s "$TLS_DIR/server.pem" || ! -s "$TLS_DIR/server-key.pem" ]]; then
  needs_server=true
elif ! openssl x509 -checkend $((30 * 24 * 3600)) -noout -in "$TLS_DIR/server.pem" >/dev/null; then
  needs_server=true   # vence em menos de 30 dias
elif [[ "$(cat "$TLS_DIR/server.san" 2>/dev/null)" != "$san" ]]; then
  needs_server=true   # lista de nomes mudou
fi

if $needs_server; then
  echo "Gerando o certificado do servidor para: ${san//,/, }"
  openssl req -newkey rsa:2048 -nodes -sha256 -keyout "$TLS_DIR/server-key.pem" \
    -out "$TLS_DIR/server.csr" -subj "/O=Umbrel/CN=Proton Mail Bridge" 2>/dev/null
  openssl x509 -req -in "$TLS_DIR/server.csr" -CA "$TLS_DIR/ca.pem" -CAkey "$TLS_DIR/ca-key.pem" \
    -CAcreateserial -days 825 -sha256 -out "$TLS_DIR/server.pem" \
    -extfile <(printf '%s\n' "basicConstraints=critical,CA:FALSE" \
                "keyUsage=critical,digitalSignature,keyEncipherment" \
                "extendedKeyUsage=serverAuth" "subjectAltName=$san") 2>/dev/null
  rm -f "$TLS_DIR/server.csr"
  echo "$san" > "$TLS_DIR/server.san"
  chmod 600 "$TLS_DIR"/*-key.pem
fi

# Tipos de conteúdo da página: o Safari só oferece instalar o perfil com o tipo da Apple
printf '%s\n' ".mobileconfig:application/x-apple-aspen-config" ".pem:application/x-pem-file" \
  ".html:text/html; charset=utf-8" > "$TLS_DIR/httpd.conf"

# Conteúdo público: CA e perfil do iOS (sem senhas; o iOS pede e-mail, usuário e senha do Bridge)
cp "$TLS_DIR/ca.pem" "$PUBLIC_DIR/ca.pem"
ca_der_b64="$(openssl x509 -in "$TLS_DIR/ca.pem" -outform der | base64 -w 0)"
uuid() { cat /proc/sys/kernel/random/uuid | tr a-z A-Z; }
cat > "$PUBLIC_DIR/proton-bridge.mobileconfig" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadVersion</key><integer>1</integer>
  <key>PayloadIdentifier</key><string>umbrel.proton-bridge</string>
  <key>PayloadUUID</key><string>$(uuid)</string>
  <key>PayloadDisplayName</key><string>Proton Mail via Bridge</string>
  <key>PayloadDescription</key><string>Conta do Proton Mail pelo Proton Mail Bridge do Umbrel ($PROFILE_HOST, IMAP 1143 e SMTP 1025 com SSL) e o certificado que protege essas conexões.</string>
  <key>PayloadOrganization</key><string>Umbrel</string>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadIdentifier</key><string>umbrel.proton-bridge.ca</string>
      <key>PayloadUUID</key><string>$(uuid)</string>
      <key>PayloadDisplayName</key><string>Proton Mail Bridge CA</string>
      <key>PayloadCertificateFileName</key><string>proton-bridge-ca.cer</string>
      <key>PayloadContent</key><data>$ca_der_b64</data>
    </dict>
    <dict>
      <key>PayloadType</key><string>com.apple.mail.managed</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadIdentifier</key><string>umbrel.proton-bridge.mail</string>
      <key>PayloadUUID</key><string>$(uuid)</string>
      <key>PayloadDisplayName</key><string>Proton Mail</string>
      <key>EmailAccountDescription</key><string>Proton</string>
      <key>EmailAccountType</key><string>EmailTypeIMAP</string>
      <key>EmailAccountName</key><string></string>
      <key>EmailAddress</key><string></string>
      <key>IncomingMailServerHostName</key><string>$PROFILE_HOST</string>
      <key>IncomingMailServerPortNumber</key><integer>1143</integer>
      <key>IncomingMailServerUseSSL</key><true/>
      <key>IncomingMailServerAuthentication</key><string>EmailAuthPassword</string>
      <key>IncomingMailServerUsername</key><string></string>
      <key>OutgoingMailServerHostName</key><string>$PROFILE_HOST</string>
      <key>OutgoingMailServerPortNumber</key><integer>1025</integer>
      <key>OutgoingMailServerUseSSL</key><true/>
      <key>OutgoingMailServerAuthentication</key><string>EmailAuthPassword</string>
      <key>OutgoingMailServerUsername</key><string></string>
      <key>OutgoingPasswordSameAsIncomingPassword</key><true/>
    </dict>
  </array>
</dict>
</plist>
EOF

cat > "$PUBLIC_DIR/index.html" <<EOF
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proton Mail Bridge</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1a1d23}
a.btn{display:inline-block;background:#6d4aff;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600}
code{background:#f1f1f4;padding:1px 5px;border-radius:4px}@media(prefers-color-scheme:dark){body{background:#14161a;color:#e8eaee}code{background:#2a2d33}}</style></head>
<body><h1>Proton Mail Bridge</h1>
<p>Perfil do iPhone/iPad com a conta de e-mail (servidor <code>$PROFILE_HOST</code>, IMAP 1143 e SMTP 1025 com SSL) e o certificado deste Umbrel.</p>
<p><a class="btn" href="proton-bridge.mobileconfig">Baixar o perfil</a></p>
<ol><li>Depois de baixar: Ajustes → Perfil Baixado → Instalar. Informe o seu e-mail, usuário e a senha do Bridge (comando <code>info</code>).</li>
<li>Ative a confiança no certificado: Ajustes → Geral → Sobre → Ajustes de Confiança de Certificado → Proton Mail Bridge CA.</li></ol>
<p>Outros clientes: <a href="ca.pem">certificado da CA (ca.pem)</a>.</p></body></html>
EOF
