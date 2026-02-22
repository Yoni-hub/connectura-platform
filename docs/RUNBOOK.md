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

## EC2 self-heal alarms (staging)
- Instance: `i-0d9447cfa53e1ed9d` (`us-east-1`)
- Alarm (system failure -> recover): `connsura-staging-ec2-system-auto-recover`
- Alarm (instance failure -> reboot): `connsura-staging-ec2-instance-auto-reboot`
- Verify alarms:
  - `aws cloudwatch describe-alarms --region us-east-1 --alarm-names connsura-staging-ec2-system-auto-recover connsura-staging-ec2-instance-auto-reboot`
- Recreate alarms:
  - `aws cloudwatch put-metric-alarm --region us-east-1 --alarm-name connsura-staging-ec2-system-auto-recover --alarm-description "Auto-recover Connsura staging EC2 when system status check fails" --namespace AWS/EC2 --metric-name StatusCheckFailed_System --dimensions Name=InstanceId,Value=i-0d9447cfa53e1ed9d --statistic Maximum --period 60 --evaluation-periods 2 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching --alarm-actions arn:aws:automate:us-east-1:ec2:recover`
  - `aws cloudwatch put-metric-alarm --region us-east-1 --alarm-name connsura-staging-ec2-instance-auto-reboot --alarm-description "Auto-reboot Connsura staging EC2 when instance status check fails" --namespace AWS/EC2 --metric-name StatusCheckFailed_Instance --dimensions Name=InstanceId,Value=i-0d9447cfa53e1ed9d --statistic Maximum --period 60 --evaluation-periods 2 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching --alarm-actions arn:aws:automate:us-east-1:ec2:reboot`

## Database and uploads
- DB service: `postgres` in Docker Compose
- DB data dir: `/opt/connsura/postgres`
- Backup: `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/connsura/postgres/connsura-$(date +%F).sql`
- Uploads path: `/opt/connsura/uploads`
