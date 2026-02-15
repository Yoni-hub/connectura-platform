#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/opt/connsura"
APP_DIR="${BASE_DIR}/app"
DEPLOY_DIR="${APP_DIR}/deploy"
ENV_DIR="${BASE_DIR}/env"
DATA_DIR="${BASE_DIR}/data"
UPLOADS_DIR="${BASE_DIR}/uploads"
POSTGRES_DIR="${BASE_DIR}/postgres"
LEGAL_DIR="${BASE_DIR}/legal"

mkdir -p "$APP_DIR" "$DEPLOY_DIR" "$ENV_DIR" "$DATA_DIR" "$UPLOADS_DIR" "$POSTGRES_DIR" "$LEGAL_DIR"
sudo chown -R 999:999 "$POSTGRES_DIR"
sudo chmod 700 "$POSTGRES_DIR"

ENV_FILE="/tmp/connsura.env"
if [[ -f "${ENV_DIR}/backend.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_DIR}/backend.env"
  set +a
fi

if [[ -f "${ENV_DIR}/db_readonly.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_DIR}/db_readonly.env"
  set +a
fi

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

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Initializing git repo in ${APP_DIR}..."
  git -C "${APP_DIR}" init
  git -C "${APP_DIR}" remote add origin "${REPO_URL}"
  git -C "${APP_DIR}" fetch origin "${REPO_BRANCH}"
  git -C "${APP_DIR}" checkout -b "${REPO_BRANCH}" "origin/${REPO_BRANCH}"
else
  git -C "${APP_DIR}" remote set-url origin "${REPO_URL}"
  git -C "${APP_DIR}" fetch origin "${REPO_BRANCH}"
  git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
  git -C "${APP_DIR}" pull origin "${REPO_BRANCH}"
fi

if [[ -d "${APP_DIR}/legal" ]]; then
  for file in terms.md privacy.md data-sharing.md; do
    if [[ -f "${APP_DIR}/legal/${file}" && ! -f "${LEGAL_DIR}/${file}" ]]; then
      cp "${APP_DIR}/legal/${file}" "${LEGAL_DIR}/${file}"
    fi
  done
fi

GIT_SHA="$(git -C "${APP_DIR}" rev-parse HEAD)"
DEPLOY_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

DB_NAME="${DB_NAME:-connsura}"
DB_USER="${DB_USER:-connsura}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_READONLY_USER="${DB_READONLY_USER:-connsura_ro}"
DB_READONLY_PASSWORD="${DB_READONLY_PASSWORD:-}"

if [[ -z "${DB_PASSWORD}" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
fi

if [[ -z "${DB_READONLY_PASSWORD}" ]]; then
  DB_READONLY_PASSWORD="$(openssl rand -hex 24)"
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi

ERROR_LOG_PATH="${ERROR_LOG_PATH:-/opt/connsura/error-events.log}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

umask 077
cat > "${ENV_DIR}/backend.env" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=8000
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://${DOMAIN}
ERROR_LOG_PATH=${ERROR_LOG_PATH}
ENABLE_AGENT_FEATURES=false
EOF

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  {
    echo "ADMIN_EMAIL=${ADMIN_EMAIL}"
    echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}"
  } >> "${ENV_DIR}/backend.env"
fi

if [[ -n "${SES_SMTP_HOST:-}" ]]; then
  echo "SES_SMTP_HOST=${SES_SMTP_HOST}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${SES_SMTP_PORT:-}" ]]; then
  echo "SES_SMTP_PORT=${SES_SMTP_PORT}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${SES_SMTP_USER:-}" ]]; then
  echo "SES_SMTP_USER=${SES_SMTP_USER}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${SES_SMTP_PASS:-}" ]]; then
  echo "SES_SMTP_PASS=${SES_SMTP_PASS}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${EMAIL_FROM:-}" ]]; then
  echo "EMAIL_FROM=${EMAIL_FROM}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${EMAIL_REPLY_TO:-}" ]]; then
  echo "EMAIL_REPLY_TO=${EMAIL_REPLY_TO}" >> "${ENV_DIR}/backend.env"
fi
if [[ -n "${EMAIL_SUPPORT_INBOX:-}" ]]; then
  echo "EMAIL_SUPPORT_INBOX=${EMAIL_SUPPORT_INBOX}" >> "${ENV_DIR}/backend.env"
fi

cat > "${ENV_DIR}/postgres.env" <<EOF
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
EOF

cat > "${ENV_DIR}/db_readonly.env" <<EOF
DB_READONLY_USER=${DB_READONLY_USER}
DB_READONLY_PASSWORD=${DB_READONLY_PASSWORD}
DB_READONLY_URL=postgresql://${DB_READONLY_USER}:${DB_READONLY_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}
EOF

chmod 600 "${ENV_DIR}/backend.env" "${ENV_DIR}/postgres.env" "${ENV_DIR}/db_readonly.env"

cat > "${DEPLOY_DIR}/Dockerfile.backend" <<'EOF'
FROM node:20-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y openssl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY connsura-backend/package*.json ./
RUN npm install

COPY connsura-backend/ ./
COPY legal/ ./legal
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

if command -v pg_isready >/dev/null 2>&1; then
  echo "Waiting for database to be ready..."
  for i in {1..30}; do
    if PGPASSWORD="${DB_PASSWORD:-}" pg_isready -h "${DB_HOST:-}" -p "${DB_PORT:-}" -U "${DB_USER:-}" -d "${DB_NAME:-}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

echo "Ensuring database schema..."
npx prisma db push
npx prisma generate

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
services:
  postgres:
    image: postgres:16
    env_file:
      - ${ENV_DIR}/postgres.env
    volumes:
      - ${POSTGRES_DIR}:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    healthcheck:
EOF
printf '%s\n' '      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]' >> "${DEPLOY_DIR}/docker-compose.yml"
cat >> "${DEPLOY_DIR}/docker-compose.yml" <<EOF
      interval: 5s
      timeout: 5s
      retries: 12

  backend:
    build:
      context: ${APP_DIR}
      dockerfile: ${DEPLOY_DIR}/Dockerfile.backend
    env_file:
      - ${ENV_DIR}/backend.env
    depends_on:
      - postgres
    volumes:
      - ${DATA_DIR}:/data
      - ${UPLOADS_DIR}:/app/uploads
      - ${LEGAL_DIR}:/legal
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

echo "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if sudo docker compose -f "${DEPLOY_DIR}/docker-compose.yml" exec -T postgres env PGPASSWORD="${DB_PASSWORD}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [[ -z "${ready:-}" ]]; then
  echo "Postgres did not become ready in time."
  exit 1
fi

echo "Ensuring read-only database user..."
sudo docker compose -f "${DEPLOY_DIR}/docker-compose.yml" exec -T postgres env PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_READONLY_USER}') THEN
    CREATE ROLE "${DB_READONLY_USER}" LOGIN PASSWORD '${DB_READONLY_PASSWORD}';
  ELSE
    ALTER ROLE "${DB_READONLY_USER}" WITH LOGIN PASSWORD '${DB_READONLY_PASSWORD}';
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE "${DB_NAME}" TO "${DB_READONLY_USER}";
GRANT USAGE ON SCHEMA public TO "${DB_READONLY_USER}";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${DB_READONLY_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "${DB_READONLY_USER}";
SQL

LOG_FILE="${BASE_DIR}/deployments.log"
echo "timestamp=${DEPLOY_TIME} sha=${GIT_SHA} branch=${REPO_BRANCH} domain=${DOMAIN} api_domain=${API_DOMAIN}" >> "${LOG_FILE}"
echo "Deploy complete."
