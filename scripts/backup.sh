# from the repo root (where docker-compose.yml and .env are)
set -a
. ./.env
set +a

ts="$(date +%Y%m%d_%H%M%S)"
mkdir -p backups

# if your postgres service is named "db" in docker-compose.yml
docker compose exec -T db sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/postgres_${POSTGRES_DB}_${ts}.dump"