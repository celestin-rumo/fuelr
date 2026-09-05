#!/usr/bin/env bash
#
# Put a backup back.
#
# Two targets, and the default is the harmless one. `--into drill` restores
# into a throwaway Postgres and tells you what came back — that is the command
# to run on an ordinary Tuesday, because a restore procedure nobody has run is
# a document rather than a procedure.
#
# `--into live` is the real thing, and it is destructive: it drops what is
# there now and replaces it with the backup, photos included. It refuses to
# run until the backup's date is typed back, so it cannot be the result of one
# wrong arrow key in a shell history.
#
set -euo pipefail

BACKUP=""
TARGET="drill"
DB_CONTAINER="${FUELR_DB_CONTAINER:-fuelr-database}"
MEDIA_CONTAINER="${FUELR_MEDIA_CONTAINER:-fuelr-backend}"
MEDIA_PATH="${FUELR_MEDIA_PATH:-/var/lib/fuelr/media}"

while [ $# -gt 0 ]; do
  case "$1" in
    --into) TARGET="$2"; shift 2 ;;
    --db-container) DB_CONTAINER="$2"; shift 2 ;;
    --media-container) MEDIA_CONTAINER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      echo
      echo "usage: restore.sh <backup-directory> [--into drill|live]"
      exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) BACKUP="$1"; shift ;;
  esac
done

say() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

[ -n "$BACKUP" ] || die "which backup? usage: restore.sh <backup-directory> [--into drill|live]"
[ -f "$BACKUP/database.dump" ] || die "$BACKUP holds no database.dump"
[ -f "$BACKUP/media.tar.gz" ] || die "$BACKUP holds no media.tar.gz"

# The manifest carries the checksums taken when the backup was written. A file
# that has rotted on disk must be found here and not halfway through a restore.
if [ -f "$BACKUP/manifest.txt" ]; then
  say "checking the files against the manifest"
  ( cd "$BACKUP" && grep -E '^[0-9a-f]{64} ' manifest.txt | sha256sum -c --quiet ) \
    || die "this backup does not match its own checksums"
fi

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || die "no container named $DB_CONTAINER"
container_env() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" |
    sed -n "s/^$2=//p" | head -1
}
DB_USER="$(container_env "$DB_CONTAINER" POSTGRES_USER)"
DB_NAME="$(container_env "$DB_CONTAINER" POSTGRES_DB)"
PG_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"

# --- a drill --------------------------------------------------------------

if [ "$TARGET" = "drill" ]; then
  CHECK="fuelr-restore-drill"
  docker rm -f "$CHECK" >/dev/null 2>&1 || true

  say "starting a throwaway Postgres"
  docker run -d --name "$CHECK" -p 15432:5432 \
    -e POSTGRES_PASSWORD=drill -e POSTGRES_USER="$DB_USER" -e POSTGRES_DB="$DB_NAME" \
    "$PG_IMAGE" >/dev/null

  for _ in $(seq 1 60); do
    docker exec "$CHECK" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
    sleep 1
  done

  docker exec -i "$CHECK" \
    pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error \
    < "$BACKUP/database.dump" || die "the dump does not restore"

  # Trimmed at the ends only: `tr -d ' '` also ate the space inside a
  # timestamp, and "2026-09-0412:40:13" is not a date anybody reads.
  ask() {
    docker exec "$CHECK" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" |
      sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
  }

  echo
  echo "Restored into $CHECK — reachable on localhost:15432"
  echo "  accounts        $(ask 'select count(*) from users')"
  echo "  recipes         $(ask 'select count(*) from recipes')"
  echo "  planned meals   $(ask 'select count(*) from planned_meals')"
  echo "  logged meals    $(ask 'select count(*) from meal_log')"
  echo "  newest recipe   $(ask "select coalesce(max(created_at)::text, 'none') from recipes")"
  echo "  photos in tar   $(tar -tzf "$BACKUP/media.tar.gz" | grep -c . || true)"
  echo
  echo "Look at it, then throw it away:  docker rm -f $CHECK"
  exit 0
fi

[ "$TARGET" = "live" ] || die "--into takes 'drill' or 'live', not '$TARGET'"

# --- the real thing -------------------------------------------------------

STAMP="$(basename "$BACKUP")"
cat <<WARNING

  This replaces the live data with the backup of $STAMP.

  Everything written since then is lost: recipes, planned meals, the diary,
  the shopping list, and every photo. There is no undo, and the backup taken
  after this one will contain the restored state.

  Type the backup's name to go ahead, anything else to stop.

WARNING
printf '  %s > ' "$STAMP"
read -r TYPED
[ "$TYPED" = "$STAMP" ] || die "not confirmed — nothing was touched"

# One last dump of what is about to be replaced. It costs seconds and it is
# the only thing standing between a mistyped restore and a lost afternoon.
SAFETY="${TMPDIR:-/tmp}/fuelr-before-restore-$(date -u +%Y-%m-%dT%H-%M-%SZ).dump"
say "dumping the current state first, to $SAFETY"
docker exec "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner > "$SAFETY" \
  || die "could not dump the current state; nothing was touched"

say "stopping the application so nothing writes during the restore"
# The database stays up — it is what is being restored into. The backend is
# what would otherwise write a row halfway through.
docker stop "$MEDIA_CONTAINER" >/dev/null

say "recreating the schema"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c 'drop schema public cascade; create schema public;' >/dev/null \
  || die "could not clear the database; the application is still stopped"

say "restoring the database"
docker exec -i "$DB_CONTAINER" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error \
  < "$BACKUP/database.dump" || die "restore failed; the application is still stopped"

say "restoring the photos"
# Emptied first: a restore that only adds leaves files from the state being
# replaced, and those are exactly the ones no row points at any more.
docker run --rm \
  --volumes-from "$MEDIA_CONTAINER" \
  -v "$BACKUP:/backup:ro" \
  alpine:3 \
  sh -c "rm -rf ${MEDIA_PATH:?}/* && tar -xzf /backup/media.tar.gz -C $MEDIA_PATH" \
  || die "restoring the photos failed; the application is still stopped"

say "starting the application"
docker start "$MEDIA_CONTAINER" >/dev/null

echo
echo "Restored from $STAMP."
echo "The state it replaced is at $SAFETY — keep it until you are sure."
