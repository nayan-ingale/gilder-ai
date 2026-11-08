#!/bin/sh
# Copies every database to S3, keeping the last seven copies on the server too. Run it from cron,
# for example every night at 03:15 UTC:
#   15 3 * * * ~/gilder-ai/backup.sh >> ~/gilder-ai/backup.log 2>&1
# Needs env/backup.env with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION and BACKUP_BUCKET
# (a bucket the app's own key cannot read or delete). Qdrant is not copied: its vectors are rebuilt
# from the PDFs, which are already in S3. Redis only holds sessions and short-lived state.
# Restore: docker compose exec -T mongo mongorestore --archive --gzip --drop < backups/<file>
set -eu
cd "$(dirname "$0")"
set -a
. ./env/backup.env
set +a

stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
name="mongo-$stamp.archive.gz"
mkdir -p backups
docker compose exec -T mongo mongodump --archive --gzip --quiet > "backups/$name"

docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_REGION \
  -v "$PWD/backups:/backups:ro" \
  amazon/aws-cli:2.27.0 s3 cp "/backups/$name" "s3://$BACKUP_BUCKET/mongo/$name" --only-show-errors

ls -1t backups/mongo-*.archive.gz | tail -n +8 | while read -r old; do rm -f -- "$old"; done
echo "$(date -u +%FT%TZ) backed up $name"
