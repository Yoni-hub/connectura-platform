#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/tmp/connsura.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DOMAIN:?DOMAIN not set}"
: "${API_DOMAIN:?API_DOMAIN not set}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL not set}"

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

sudo mkdir -p /etc/needrestart/conf.d
sudo tee /etc/needrestart/conf.d/99-connsura.conf >/dev/null <<'EOF'
$nrconf{restart} = 'a';
$nrconf{kernelhints} = -1;
EOF

echo "Provisioning server packages..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw git nginx

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER" || true
fi

sudo systemctl enable --now docker
sudo systemctl enable --now nginx

echo "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
fi

echo "Creating directories..."
sudo mkdir -p /opt/connsura /opt/connsura/deploy /opt/connsura/env /opt/connsura/data /opt/connsura/uploads
sudo chown -R "$USER":"$USER" /opt/connsura

echo "Writing Nginx config..."
sudo tee /etc/nginx/sites-available/connsura.conf >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name ${API_DOMAIN};
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/connsura.conf /etc/nginx/sites-enabled/connsura.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Installing certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

if sudo certbot certificates 2>/dev/null | grep -q "${DOMAIN}"; then
  sudo certbot renew --quiet
else
  sudo certbot --nginx -d "${DOMAIN}" -d "${API_DOMAIN}" \
    --agree-tos -m "${LETSENCRYPT_EMAIL}" --non-interactive --redirect
fi

sudo systemctl reload nginx
echo "Provisioning complete."
