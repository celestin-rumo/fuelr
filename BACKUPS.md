# Backups

Fuelr keeps its data in two places, and a backup that forgets either one is a
backup nobody can use:

| What | Where | Why it matters |
| ---- | ----- | -------------- |
| Postgres | the `postgres_data` volume | accounts, recipes, the week, the diary, the shopping list |
| Photos | the `recipe_media` volume | the database stores only paths; without the files, a restored library is grey rectangles |

Two scripts do the work. `scripts/backup.sh` takes a backup **and restores it
into a throwaway Postgres before keeping it** — an untested backup is a
hypothesis, and the day it is needed is the worst possible day to find out.
`scripts/restore.sh` puts one back, into a drill by default and into the live
application only when asked in so many words.

---

## Every night, without anybody

```bash
sudo install -Dm755 scripts/backup.sh /opt/fuelr/scripts/backup.sh
sudo cp scripts/fuelr-backup.service scripts/fuelr-backup.timer /etc/systemd/system/
sudo mkdir -p /etc/fuelr && sudo tee /etc/fuelr/backup.env <<'ENV'
FUELR_BACKUP_DIR=/var/backups/fuelr
FUELR_BACKUP_KEEP=14
ENV
sudo systemctl daemon-reload
sudo systemctl enable --now fuelr-backup.timer
```

Check it took:

```bash
systemctl list-timers fuelr-backup.timer     # when it next runs
journalctl -u fuelr-backup.service -n 40     # what the last run said
ls -lh /var/backups/fuelr                    # what it left behind
```

The unit's `WorkingDirectory` is `/opt/fuelr` — the one path in it that is not
portable. Adjust it if the checkout lives somewhere else on your machine.

Without systemd, the same job as a cron line:

```cron
20 3 * * *  cd /opt/fuelr && ./scripts/backup.sh >> /var/log/fuelr-backup.log 2>&1
```

---

## A backup on the same disk is not a backup

It protects against a mistake — a bad migration, a `DELETE` with no `WHERE`, a
restore of the wrong thing. It protects against **nothing** that happens to the
machine: a failed disk, a lost provider account, a deleted VM take the data and
its backups together.

So a copy has to leave the host. `FUELR_BACKUP_POST_HOOK` runs after a
successful backup with the backup's directory as `$1`, and its failure fails
the backup — a copy that never left the machine is not the backup that was
asked for.

```bash
# /etc/fuelr/backup.env
FUELR_BACKUP_POST_HOOK=rclone copy "$1" remote:fuelr-backups/$(basename "$1")
```

Anything works there: `rclone` to object storage, `rsync` over SSH to another
machine, `restic` if you want deduplication and encryption. The one rule is
that the far end must be somewhere a compromise of this host cannot reach — an
append-only bucket, or credentials that cannot delete.

**This is not configured yet.** Until it is, the backups are on the same disk
as the data, and that is worth knowing rather than assuming otherwise.

---

## Practising the restore

Run this on an ordinary Tuesday. A restore procedure nobody has run is a
document, not a procedure.

```bash
./scripts/restore.sh /var/backups/fuelr/2026-09-05T03-20-14Z
```

It checks the files against the checksums in the backup's own manifest, starts
a throwaway Postgres on **localhost:15432**, restores into it, and prints what
came back:

```
Restored into fuelr-restore-drill — reachable on localhost:15432
  accounts        8530
  recipes         7875
  planned meals   1289
  logged meals    168
  newest recipe   2026-09-04 12:40:13.590412+00
  photos in tar   149

Look at it, then throw it away:  docker rm -f fuelr-restore-drill
```

Read those numbers against what you expect. "It restored" is not the same
claim as "it restored the data" — an empty database restores perfectly.

Connect to it if you want to look closer:

```bash
psql -h localhost -p 15432 -U fuelr -d fuelr    # password: drill
docker rm -f fuelr-restore-drill                # when you are done
```

---

## Putting it back for real

```bash
./scripts/restore.sh /var/backups/fuelr/2026-09-05T03-20-14Z --into live
```

**This is destructive.** Everything written since the backup is lost: recipes,
planned meals, the diary, the shopping list, every photo. The script says so
and refuses to move until the backup's own name is typed back, so it cannot be
the result of one wrong arrow key in a shell history.

What it does, in order:

1. **Dumps the current state first**, to `/tmp/fuelr-before-restore-<stamp>.dump`.
   It costs seconds and it is the only thing between a mistyped restore and a
   lost afternoon. Keep it until you are sure.
2. Stops `fuelr-backend`, so nothing writes a row halfway through. The database
   stays up — it is what is being restored into.
3. Drops and recreates the schema, then restores the dump.
4. **Empties the media volume** and unpacks the archive. A restore that only
   added would leave files from the state being replaced, and those are exactly
   the ones no row points at any more.
5. Starts the backend again.

If a step fails, the script stops and says the application is still stopped.
That is deliberate: a half-restored Fuelr serving requests is worse than one
that is down while you look.

Afterwards, check the obvious things: sign in, open the library, open a recipe
that has a photograph. Then take a fresh backup — the nightly one would
otherwise be the first record of the restored state, and if the restore was
wrong you have until 03:20 to notice.

---

## What is in a backup

```
/var/backups/fuelr/2026-09-05T03-20-14Z/
├── database.dump     pg_dump --format=custom, compressed
├── media.tar.gz      everything under /var/lib/fuelr/media
└── manifest.txt      what it holds, and the checksums
```

`manifest.txt` is written for whoever finds the directory without this file
open — what was backed up, from where, how many accounts and recipes and
photos it holds, the exact command to restore it, and a SHA-256 for each file.
`restore.sh` checks those checksums before it touches anything: a file that has
rotted on disk has to be found there, not halfway through a restore.

**The database is dumped first and the photos second, on purpose.** A photo
uploaded between the two lands in the archive with no row pointing at it — an
orphan file, which costs a few kilobytes and nothing else. The other order
produces a row pointing at a file that is not in the backup, which is a missing
photo after a restore.

**`pg_dump` runs inside the database container**, so its version can never be
older than the server it is reading. That is the usual way a backup script
starts failing quietly after an upgrade nobody connected to it.

---

## Options

Everything is an environment variable, and every one has a working default.

| Variable | Default | |
| -------- | ------- | - |
| `FUELR_BACKUP_DIR` | `/var/backups/fuelr` | where backups land (`--out`) |
| `FUELR_BACKUP_KEEP` | `14` | how many to keep (`--keep`; `0` keeps everything) |
| `FUELR_BACKUP_POST_HOOK` | *(none)* | runs on success with the directory as `$1` |
| `FUELR_DB_CONTAINER` | `fuelr-database` | (`--db-container`) |
| `FUELR_MEDIA_CONTAINER` | `fuelr-backend` | (`--media-container`) |
| `FUELR_MEDIA_PATH` | `/var/lib/fuelr/media` | inside that container |

`--no-verify` skips the restore check. It exists for a machine too small to run
a second Postgres, and it takes the entire point of this script with it.

Containers are addressed **by name**, not by compose service: a service name is
only unique inside its project, and several projects share this host. The
compose files pin the names for the same reason — see the note on
`BACKEND_INTERNAL_URL` in `docker-compose.prod.yml`.

Pruning only ever removes directories whose names match the timestamp shape
this script writes, so pointing `--out` at the wrong place cannot delete
somebody else's files.

---

## Running it against the dev stack

The scripts are the same everywhere; dev just has different data.

```bash
./scripts/backup.sh --out /tmp/fuelr-backups --keep 3
./scripts/restore.sh /tmp/fuelr-backups/<stamp>
```

Which is also how to change them safely: break the script here, not at 2am on
the production host.
