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
- DB path: `/opt/connsura/data/connsura.db`
- Backup: `sqlite3 /opt/connsura/data/connsura.db ".backup /opt/connsura/data/connsura-$(date +%F).db"`
- Uploads path: `/opt/connsura/uploads`
