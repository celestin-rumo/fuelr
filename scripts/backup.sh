#!/usr/bin/env bash
#
# Take a backup of Fuelr, and prove it restores.
#
# Two things are backed up, because the application keeps its data in two
# places: Postgres, and the `recipe_media` volume the database only stores
# paths into. A dump without the photos restores a library of grey rectangles.
#
# The database is dumped first and the media archived second, on purpose. A
# photo uploaded between the two lands in the archive without a row pointing at
# it — an orphan file, which costs a few kilobytes and nothing else. The other
# order produces a row pointing at a file that is not in the backup, which is a
# missing photo after a restore.
#
# What makes this more than a dump: every backup is restored into a throwaway
# Postgres before it is kept. An untested backup is a hypothesis, and the day
# it is needed is the worst possible day to find out.
#
set -euo pipefail

# --- settings, all overridable from the environment ----------------------

# Container names rather than compose service names: a service name is only
# unique within its project, and several projects share this host. The compose
# files pin these names for the same reason.
DB_CONTAINER="${FUELR_DB_CONTAINER:-fuelr-database}"
MEDIA_CONTAINER="${FUELR_MEDIA_CONTAINER:-fuelr-backend}"
MEDIA_PATH="${FUELR_MEDIA_PATH:-/var/lib/fuelr/media}"

OUT_DIR="${FUELR_BACKUP_DIR:-/var/backups/fuelr}"
KEEP="${FUELR_BACKUP_KEEP:-14}"
VERIFY=1

# Runs after a successful backup, with the backup's directory as $1. This is
# where a copy leaves the machine — see BACKUPS.md. A backup sitting on the
# same disk as the data is protection against a mistake, not against the disk.
POST_HOOK="${FUELR_BACKUP_POST_HOOK:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="$2"; shift 2 ;;
    --keep) KEEP="$2"; shift 2 ;;
    --no-verify) VERIFY=0; shift ;;
    --db-container) DB_CONTAINER="$2"; shift 2 ;;
    --media-container) MEDIA_CONTAINER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

say() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

# --- what we are backing up ----------------------------------------------

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || die "no container named $DB_CONTAINER"
docker inspect "$MEDIA_CONTAINER" >/dev/null 2>&1 || die "no container named $MEDIA_CONTAINER"

# Read the credentials off the running container rather than keeping a second
# copy of them here. One place to be wrong, and it is the compose file.
container_env() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" |
    sed -n "s/^$2=//p" | head -1
}

DB_USER="$(container_env "$DB_CONTAINER" POSTGRES_USER)"
DB_NAME="$(container_env "$DB_CONTAINER" POSTGRES_DB)"
[ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || die "could not read POSTGRES_USER/DB from $DB_CONTAINER"

# The same image the data lives in, so `pg_dump` can never be older than the
# server it is reading — the classic way a backup script starts failing after
# an upgrade nobody connected to it.
PG_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DEST="$OUT_DIR/$STAMP"
mkdir -p "$DEST"

say "backing up $DB_NAME from $DB_CONTAINER into $DEST"

# --- 1. the database ------------------------------------------------------

# Custom format: compressed, and `pg_restore` can then rebuild selectively and
# in parallel rather than replaying one long stream of SQL.
docker exec "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner \
  > "$DEST/database.dump" || die "pg_dump"

[ -s "$DEST/database.dump" ] || die "the dump is empty"
say "database dumped ($(du -h "$DEST/database.dump" | cut -f1))"

# --- 2. the photos --------------------------------------------------------

# `--volumes-from` rather than the volume's name: the name carries the compose
# project prefix, which differs between this host and anybody else's.
docker run --rm \
  --volumes-from "$MEDIA_CONTAINER" \
  -v "$DEST:/backup" \
  alpine:3 \
  tar -czf /backup/media.tar.gz -C "$MEDIA_PATH" . || die "archiving $MEDIA_PATH"

say "photos archived ($(du -h "$DEST/media.tar.gz" | cut -f1))"

# --- 3. proof that it restores -------------------------------------------

if [ "$VERIFY" = "1" ]; then
  say "verifying — restoring into a throwaway Postgres"

  CHECK="fuelr-backup-verify-$$"
  # Trapped rather than removed at the end: a failure between here and the
  # last line must not leave a stray Postgres running on the host.
  cleanup() { docker rm -f "$CHECK" >/dev/null 2>&1 || true; }
  trap cleanup EXIT

  docker run -d --name "$CHECK" \
    -e POSTGRES_PASSWORD=verify -e POSTGRES_USER="$DB_USER" -e POSTGRES_DB="$DB_NAME" \
    "$PG_IMAGE" >/dev/null

  for _ in $(seq 1 60); do
    docker exec "$CHECK" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$CHECK" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
    || die "the verification database never came up"

  docker exec -i "$CHECK" \
    pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error \
    < "$DEST/database.dump" || die "the dump does not restore"

  # It restored — but an empty database restores too. Count what the
  # application cannot work without.
  counts() {
    docker exec "$CHECK" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" | tr -d ' '
  }
  USERS="$(counts 'select count(*) from users')"
  RECIPES="$(counts 'select count(*) from recipes')"
  FOODS="$(counts 'select count(*) from foods')"

  [ "$USERS" -ge 1 ] || die "restored, but there is not a single account in it"
  [ "$FOODS" -ge 1 ] || die "restored, but the reference food table is empty"

  say "restored: $USERS accounts, $RECIPES recipes, $FOODS reference foods"

  # The archive too: a tar that lists is a tar that extracts.
  MEDIA_FILES="$(tar -tzf "$DEST/media.tar.gz" | grep -c . || true)"
  say "archive lists $MEDIA_FILES entries"

  cleanup
  trap - EXIT
else
  USERS="not verified"; RECIPES="not verified"; FOODS="not verified"
  MEDIA_FILES="not verified"
  say "verification skipped (--no-verify)"
fi

# --- 4. what is in here, for whoever finds it -----------------------------

{
  echo "Fuelr backup"
  echo "taken            $STAMP (UTC)"
  echo "host             $(hostname)"
  echo "database         $DB_NAME on $DB_CONTAINER ($PG_IMAGE)"
  echo "media            $MEDIA_PATH on $MEDIA_CONTAINER"
  echo "accounts         $USERS"
  echo "recipes          $RECIPES"
  echo "reference foods  $FOODS"
  echo "media entries    $MEDIA_FILES"
  echo
  echo "restore with:    scripts/restore.sh $DEST"
  echo
  sha256sum "$DEST/database.dump" "$DEST/media.tar.gz" | sed "s|$DEST/||"
} > "$DEST/manifest.txt"

# --- 5. keep the last few -------------------------------------------------

# Only ever prunes directories this script made, matched on the timestamp
# shape: pointing `--out` at the wrong place must not delete somebody's files.
if [ "$KEEP" -gt 0 ]; then
  mapfile -t OLD < <(
    find "$OUT_DIR" -maxdepth 1 -type d \
      -regextype posix-extended \
      -regex '.*/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z' \
      | sort -r | tail -n "+$((KEEP + 1))"
  )
  for dir in "${OLD[@]:-}"; do
    [ -n "$dir" ] || continue
    say "pruning $(basename "$dir")"
    rm -rf "$dir"
  done
fi

# --- 6. off the machine ---------------------------------------------------

if [ -n "$POST_HOOK" ]; then
  say "post hook: $POST_HOOK"
  # It runs last and its failure fails the backup: a copy that never left the
  # machine is not the backup that was asked for.
  FUELR_BACKUP_PATH="$DEST" sh -c "$POST_HOOK" _ "$DEST" || die "post hook"
fi

say "done — $DEST"
cat "$DEST/manifest.txt"
