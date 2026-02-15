# GeoIP (GeoLite2 City)

Connsura uses the MaxMind GeoLite2 City database for city-level geolocation on:
- Login alerts
- Login activity history
- Active sessions

## Staging setup
1. Create a MaxMind account and generate a **GeoLite2** license key.
2. Set env vars on the staging server:

```
MAXMIND_LICENSE_KEY=your_key
GEOIP_DB_PATH=/opt/connsura/geo/GeoLite2-City.mmdb
```

3. Download/update the database:

```
cd /opt/connsura/connsura-backend
chmod +x scripts/update-geolite2.sh
./scripts/update-geolite2.sh
```

## Update script
The script downloads and installs the mmdb file:
- `scripts/update-geolite2.sh`

Recommended cron (weekly):
```
0 3 * * 1 cd /opt/connsura/connsura-backend && ./scripts/update-geolite2.sh >> /var/log/connsura-geoip.log 2>&1
```

## Notes
- Private IPs are ignored.
- Location snapshots are stored in audit logs and session records for historical consistency.
