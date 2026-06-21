#!/bin/bash
set -e

SSH_USER="${SSH_USER:-ubuntu}"
SSH_PASSWORD="${SSH_PASSWORD:-umbrel}"
SSH_PORT="${SSH_PORT:-2222}"
WEB_PORT="${WEB_PORT:-4000}"

# Create user if not exists
if ! id "$SSH_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$SSH_USER"
fi

# Set password
echo "$SSH_USER:$SSH_PASSWORD" | chpasswd

# Passwordless sudo
echo "$SSH_USER ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/"$SSH_USER"
chmod 440 /etc/sudoers.d/"$SSH_USER"

# Configure SSH
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
grep -qE '^Port ' /etc/ssh/sshd_config \
    && sed -i "s/^Port .*/Port $SSH_PORT/" /etc/ssh/sshd_config \
    || echo "Port $SSH_PORT" >> /etc/ssh/sshd_config

# Start SSH daemon
/usr/sbin/sshd

# Start web terminal (foreground) — root can su without a password
exec ttyd \
    --port "$WEB_PORT" \
    --credential "$SSH_USER:$SSH_PASSWORD" \
    /bin/su - "$SSH_USER"
