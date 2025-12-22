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
: "${REPO_URL:?REPO_URL not set}"
: "${REPO_BRANCH:?REPO_BRANCH not set}"

APP_DIR="/opt/connsura"
DEPLOY_DIR="${APP_DIR}/deploy"
ENV_DIR="${APP_DIR}/env"
DATA_DIR="${APP_DIR}/data"
UPLOADS_DIR="${APP_DIR}/uploads"

mkdir -p "$DEPLOY_DIR" "$ENV_DIR" "$DATA_DIR" "$UPLOADS_DIR"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch origin "${REPO_BRANCH}"
  git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
  git -C "${APP_DIR}" pull origin "${REPO_BRANCH}"
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi

umask 077
cat > "${ENV_DIR}/backend.env" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=8000
DATABASE_URL=file:/data/connsura.db
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://${DOMAIN}
EOF

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  {
    echo "ADMIN_EMAIL=${ADMIN_EMAIL}"
    echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}"
  } >> "${ENV_DIR}/backend.env"
fi

cat > "${DEPLOY_DIR}/Dockerfile.backend" <<'EOF'
FROM node:20-slim
WORKDIR /app

COPY connsura-backend/package*.json ./
RUN npm install

COPY connsura-backend/ ./
RUN npx prisma generate

COPY deploy/entrypoint.backend.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
EOF

cat > "${DEPLOY_DIR}/entrypoint.backend.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

DB_FILE="${DATABASE_URL#file:}"
if [[ ! -f "${DB_FILE}" ]]; then
  echo "Initializing SQLite database at ${DB_FILE}"
  npx prisma db execute --file prisma/migrations/manual-init.sql
  npx prisma generate
fi

exec "$@"
EOF
chmod +x "${DEPLOY_DIR}/entrypoint.backend.sh"

cat > "${DEPLOY_DIR}/Dockerfile.frontend" <<'EOF'
FROM node:20-slim
WORKDIR /app

COPY connsura-frontend/package*.json ./
RUN npm install

COPY connsura-frontend/ ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
EOF

cat > "${DEPLOY_DIR}/docker-compose.yml" <<EOF
version: "3.8"
services:
  backend:
    build:
      context: ${APP_DIR}
      dockerfile: ${DEPLOY_DIR}/Dockerfile.backend
    env_file:
      - ${ENV_DIR}/backend.env
    volumes:
      - ${DATA_DIR}:/data
      - ${UPLOADS_DIR}:/app/uploads
    ports:
      - "127.0.0.1:8000:8000"
    restart: unless-stopped

  frontend:
    build:
      context: ${APP_DIR}
      dockerfile: ${DEPLOY_DIR}/Dockerfile.frontend
      args:
        VITE_API_URL: https://${API_DOMAIN}
    ports:
      - "127.0.0.1:4173:4173"
    restart: unless-stopped
EOF

echo "Building and starting containers..."
sudo docker compose -f "${DEPLOY_DIR}/docker-compose.yml" up -d --build
echo "Deploy complete."
