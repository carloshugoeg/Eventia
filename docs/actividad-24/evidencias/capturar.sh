#!/usr/bin/env bash
# Regenera las transcripciones curl de Actividad 24 contra una base temporal.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/tmp/act24-evidencia-run"
PORT=39241
BASE="http://127.0.0.1:$PORT"
PASS='Eventia2026!'

rm -rf "$WORK"
mkdir -p "$WORK"
export DATABASE_PATH="$WORK/act24.sqlite"
export PORT

cd "$ROOT"
node scripts/seed.js >"$WORK/seed.log"
node src/server.js >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf "$BASE/api/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" -ne 1 ]]; then
  echo "el servidor no respondió en $BASE" >&2
  cat "$WORK/server.log" >&2 || true
  exit 1
fi

save() {
  local name="$1"
  local expect="$2"
  local summary="$3"
  shift 3
  curl -sS -D "$WORK/$name.hdr" -o "$WORK/$name.body" "$@"
  {
    printf '%s\n\n' "$summary"
    cat "$WORK/$name.hdr"
    printf '\n'
    cat "$WORK/$name.body"
    printf '\n'
  } >"$OUT/$name.txt"
  local status
  status="$(awk 'NR==1 { print $2 }' "$WORK/$name.hdr")"
  printf '%s %s\n' "$name" "$status"
  if [[ "$status" != "$expect" ]]; then
    echo "$name: esperado HTTP $expect, obtuvo $status" >&2
    exit 1
  fi
}

login() {
  local jar="$1"
  local email="$2"
  curl -sS -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}" \
    "$BASE/api/auth/login"
}

save 00-login-organizador 200 "POST /api/auth/login como organizador@eventia.demo" \
  -c "$WORK/org.jar" -H 'Content-Type: application/json' \
  -d "{\"email\":\"organizador@eventia.demo\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login"

login "$WORK/andrea.jar" "andrea@eventia.demo" >/dev/null
DIEGO_JSON="$(login "$WORK/diego.jar" "diego@eventia.demo")"
DIEGO_ID="$(printf '%s' "$DIEGO_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).user.id))')"

save 00-registro-organizador-b 201 "POST /api/auth/register como Organizador B" \
  -c "$WORK/orgb.jar" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Organizador B\",\"email\":\"orgb@eventia.demo\",\"password\":\"$PASS\",\"role\":\"organizer\"}" \
  "$BASE/api/auth/register"

EVENT_ID="$(curl -sS "$BASE/api/events" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).events[0].id))')"
FUTURE="$(node -e 'process.stdout.write(new Date(Date.now()+30*864e5).toISOString())')"
OWNER_BODY="{\"title\":\"Evento editado por su dueño\",\"description\":\"Descripción suficientemente larga para validar el cambio.\",\"location\":\"Zona 3 Xela\",\"category\":\"Tecnología\",\"starts_at\":\"$FUTURE\",\"capacity\":40}"
FOREIGN_BODY="{\"title\":\"Intento de cambio ajeno\",\"description\":\"Descripción suficientemente larga para validar el cambio.\",\"location\":\"Zona 3 Xela\",\"category\":\"Tecnología\",\"starts_at\":\"$FUTURE\",\"capacity\":40}"
CLOSED_BODY="{\"title\":\"Reapertura prohibida\",\"description\":\"Descripción suficientemente larga para validar el cambio.\",\"location\":\"Zona 3 Xela\",\"category\":\"Tecnología\",\"starts_at\":\"$FUTURE\",\"capacity\":40}"

printf 'evento %s\ndiego %s\n' "$EVENT_ID" "$DIEGO_ID" >"$OUT/ids.txt"

save prueba-1 401 "GET /api/registrations sin cookie" "$BASE/api/registrations"
save prueba-2 200 "GET /api/registrations con la cookie de andrea@eventia.demo" \
  -b "$WORK/andrea.jar" "$BASE/api/registrations"
save prueba-3 200 "PATCH /api/events/$EVENT_ID como dueño, Colectivo Xela" \
  -b "$WORK/org.jar" -X PATCH -H 'Content-Type: application/json' -d "$OWNER_BODY" "$BASE/api/events/$EVENT_ID"
save prueba-4 403 "PATCH /api/events/$EVENT_ID como Organizador B, que no es el dueño" \
  -b "$WORK/orgb.jar" -X PATCH -H 'Content-Type: application/json' -d "$FOREIGN_BODY" "$BASE/api/events/$EVENT_ID"
save prueba-4-lectura 200 "GET /api/events/$EVENT_ID después del PATCH rechazado de Organizador B" \
  "$BASE/api/events/$EVENT_ID"
save prueba-5 403 "GET /api/registrations?userId=$DIEGO_ID con la cookie de andrea@eventia.demo" \
  -b "$WORK/andrea.jar" "$BASE/api/registrations?userId=$DIEGO_ID"
save prueba-6-token-invalido 401 "GET /api/registrations con una cookie eventia_session de 64 hex que no existe" \
  -H "Cookie: eventia_session=$(openssl rand -hex 32)" "$BASE/api/registrations"

sqlite3 "$DATABASE_PATH" "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=(SELECT id FROM users WHERE email='andrea@eventia.demo');"
save prueba-6 401 "GET /api/registrations con la cookie de andrea@eventia.demo tras poner expires_at en el año 2000" \
  -b "$WORK/andrea.jar" "$BASE/api/registrations"

sqlite3 "$DATABASE_PATH" "UPDATE events SET starts_at='2020-01-01T00:00:00.000Z' WHERE id='$EVENT_ID';"
save situacion-d 409 "PATCH /api/events/$EVENT_ID como dueño, con starts_at ya en 2020 y una fecha futura en el cuerpo" \
  -b "$WORK/org.jar" -X PATCH -H 'Content-Type: application/json' -d "$CLOSED_BODY" "$BASE/api/events/$EVENT_ID"
save situacion-d-lectura 200 "GET /api/events/$EVENT_ID después del PATCH rechazado del dueño" \
  "$BASE/api/events/$EVENT_ID"
save situacion-d-ajeno 403 "PATCH /api/events/$EVENT_ID como Organizador B, sobre el mismo evento cerrado" \
  -b "$WORK/orgb.jar" -X PATCH -H 'Content-Type: application/json' -d "$FOREIGN_BODY" "$BASE/api/events/$EVENT_ID"
sqlite3 "$DATABASE_PATH" "SELECT starts_at FROM events WHERE id='$EVENT_ID';" >"$OUT/situacion-d-starts-at.txt"

node --input-type=module -e '
import { readFileSync } from "node:fs";
const afterForeign = JSON.parse(readFileSync(process.argv[1], "utf8"));
const afterClosed = JSON.parse(readFileSync(process.argv[2], "utf8"));
const title = "Evento editado por su dueño";
if (afterForeign.event.title !== title) {
  console.error("prueba 4 escribió el título:", afterForeign.event.title);
  process.exit(1);
}
if (afterClosed.event.title !== title) {
  console.error("situación D escribió el título:", afterClosed.event.title);
  process.exit(1);
}
if (afterClosed.event.starts_at !== "2020-01-01T00:00:00.000Z") {
  console.error("situación D cambió starts_at:", afterClosed.event.starts_at);
  process.exit(1);
}
console.log("título sin cambios tras 403 y 409");
' "$WORK/prueba-4-lectura.body" "$WORK/situacion-d-lectura.body"
