#!/bin/bash
# Rotate Synapse's registration_shared_secret, macaroon_secret_key and form_secret.
#
# Run on the NAS (where the containers live):
#   ./scripts/rotate-synapse-secrets.sh                      # dev:  fitapp-dev-synapse
#   ./scripts/rotate-synapse-secrets.sh fitapp-prod-synapse  # prod
#
# New values are generated inside the container and written straight into
# /data/homeserver.yaml, so they are never printed or stored anywhere else.
# A timestamped backup of the old config is kept next to it in /data.
#
# Side effects:
#   - macaroon_secret_key change invalidates every existing Matrix access token,
#     so all Matrix sessions are logged out. The bot and backend log in with
#     BOT_PASSWORD, so they recover once restarted (this script restarts the bot).
#   - registration_shared_secret is read from homeserver.yaml by
#     register_new_matrix_user, so production/create-bot-user.sh keeps working.

set -euo pipefail

SYNAPSE_CONTAINER="${1:-fitapp-dev-synapse}"
BOT_CONTAINER="${SYNAPSE_CONTAINER/synapse/bot}"
DOCKER="${DOCKER:-docker}"

if ! $DOCKER ps --format '{{.Names}}' | grep -qx "$SYNAPSE_CONTAINER"; then
  echo "❌ Container '$SYNAPSE_CONTAINER' is not running." >&2
  echo "   Running Synapse containers:" >&2
  $DOCKER ps --format '{{.Names}}' | grep -i synapse >&2 || echo "   (none)" >&2
  exit 1
fi

echo "🔐 Rotating secrets in $SYNAPSE_CONTAINER:/data/homeserver.yaml ..."

$DOCKER exec -i "$SYNAPSE_CONTAINER" python - <<'PY'
import os, re, secrets, shutil, sys, time

path = os.environ.get("HS_CONFIG", "/data/homeserver.yaml")
keys = ["registration_shared_secret", "macaroon_secret_key", "form_secret"]

with open(path) as f:
    text = f.read()

for key in keys:
    pattern = re.compile(rf"^{key}:.*$", re.MULTILINE)
    count = len(pattern.findall(text))
    if count != 1:
        sys.exit(f"Expected exactly one '{key}:' line in {path}, found {count}; nothing changed.")
    value = secrets.token_urlsafe(48)  # [A-Za-z0-9_-], safe inside YAML double quotes
    text = pattern.sub(f'{key}: "{value}"', text)

backup = f"{path}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
shutil.copy2(path, backup)
with open(path, "w") as f:  # rewrite in place to keep owner/permissions
    f.write(text)

print(f"   Updated: {', '.join(keys)}")
print(f"   Backup:  {backup}")
PY

echo "🔄 Restarting $SYNAPSE_CONTAINER ..."
$DOCKER restart "$SYNAPSE_CONTAINER" >/dev/null

if $DOCKER ps --format '{{.Names}}' | grep -qx "$BOT_CONTAINER"; then
  echo "🔄 Restarting $BOT_CONTAINER so it logs in again ..."
  sleep 5
  $DOCKER restart "$BOT_CONTAINER" >/dev/null
fi

echo "✅ Done. Check Synapse came back up:  $DOCKER logs --tail 30 $SYNAPSE_CONTAINER"
echo "   The backup in /data still holds the OLD (leaked) secrets; delete it once Synapse is healthy:"
echo "   $DOCKER exec $SYNAPSE_CONTAINER sh -c 'rm /data/homeserver.yaml.bak-*'"
