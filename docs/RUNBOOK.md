# Runbook

## Connect to the server
- `ssh -i <key> -p <port> <user>@<host>`

## Check container status
- `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml ps`

## Tail logs
- Backend: `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml logs -f backend`
- Frontend: `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml logs -f frontend`

## Restart after changes
- `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml up -d --build`

## Nginx and TLS
- Validate config: `sudo nginx -t`
- Restart Nginx: `sudo systemctl restart nginx`
- Renew certs: `sudo certbot renew --dry-run`

## Database and uploads
- DB service: `postgres` in Docker Compose
- DB data dir: `/opt/connsura/postgres`
- Backup: `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/connsura/postgres/connsura-$(date +%F).sql`
- Uploads path: `/opt/connsura/uploads`
