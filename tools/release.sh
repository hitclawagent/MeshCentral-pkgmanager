#!/usr/bin/env bash
# release.sh — release procedure for the pkgmanager plugin (cache/crash-proof).
#
# Usage: tools/release.sh <version>     e.g. tools/release.sh 2.0.5
#
# Enforces the invariants that MeshCentral's plugin screen depends on:
#   I1. config.json is valid JSON and its configUrl field is SELF-REFERENCING
#       (== the raw URL it is served at). A mismatch = crash loop on official
#       MeshCentral 1.3.1 (pluginHandler getPluginLatest: reject() inside
#       forEach + unhandled rejection kills Node 24).
#   I2. version consistent across config.json / pkgmanager.js (obj.version) /
#       README ("Current version").
#   I3. pkgmanager.js passes node --check.
#   I4. raw.githubusercontent.com serves the NEW version after push (the
#       Fastly edge can serve a STALE config for a while — wait it out; do not
#       tell the user "done" while raw is stale, or his update check sees the
#       old version).
set -euo pipefail

VER="${1:?usage: tools/release.sh <version>}"
REPO="hitclawagent/MeshCentral-pkgmanager"
RAW="https://raw.githubusercontent.com/${REPO}/main/config.json"
cd "$(dirname "$0")/.."

echo "== I1/I2: invariant check =="
python3 - "$VER" <<'EOF'
import json, re, sys
ver = sys.argv[1]
cfg = json.load(open('config.json'))
assert cfg['configUrl'] == 'https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/config.json', \
    "INVARIANTE ROTTA: configUrl field deve essere self-referencing (raw main), attuale: " + str(cfg['configUrl'])
assert cfg['downloadUrl'].startswith('https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/'), \
    "INVARIANTE ROTTA: downloadUrl fuori dal raw main: " + str(cfg['downloadUrl'])
assert cfg['version'] == ver, f"config.json version {cfg['version']} != {ver}"
src = open('pkgmanager.js').read()
m = re.search(r"obj\.version = '([^']+)'", src)
assert m and m.group(1) == ver, f"pkgmanager.js version {m and m.group(1)} != {ver}"
mc = re.search(r"obj\.pkgClientVersion = function \(\) \{ return '([^']+)'", src)
assert mc and mc.group(1) == ver, f"pkgClientVersion literal {mc and mc.group(1)} != {ver} (deve combaciare: handshake client/server)"
rd = open('README.md').read()
assert f"Current version: **{ver}**" in rd, "README current version != " + ver
print("invarianti OK")
EOF

echo "== I3: node --check =="
node --check pkgmanager.js

echo "== I5: exports invariant (every obj.pkg* must be in exports) =="
node tools/test-exports.js

echo "== build zips =="
python3 - <<EOF
import zipfile, shutil, os, json
ver = "${VER}"
with zipfile.ZipFile('pkgmanager-code-latest.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.write('pkgmanager.js','pkgmanager.js'); z.write('config.json','config.json')
shutil.copyfile('pkgmanager-code-latest.zip', f'pkgmanager-code-{ver}.zip')
# full: binari del downloader riusati dall'ultimo full esistente (per-OS binaries sono immutabili)
prev = None
import glob
cands = sorted(glob.glob('pkgmanager-full-*.zip'))
if cands: prev = cands[-1]
with zipfile.ZipFile(f'pkgmanager-full-{ver}.zip','w',zipfile.ZIP_DEFLATED) as out:
    if prev:
        src = zipfile.ZipFile(prev)
        for i in src.infolist():
            if i.filename.endswith('/'): continue
            if i.filename == 'pkgmanager/pkgmanager.js': out.write('pkgmanager.js','pkgmanager/pkgmanager.js')
            elif i.filename == 'pkgmanager/config.json': out.write('config.json','pkgmanager/config.json')
            else: out.writestr(i.filename, src.read(i.filename))
    else:
        raise SystemExit("serve un pkgmanager-full-<old>.zip locale per riusare i binari")
print("zip pronti")
EOF

echo "== commit + push =="
git add -A
git commit -m "pkgmanager v${VER}" --quiet || echo "(nessuna modifica da committare)"
git push --quiet origin main

echo "== release =="
gh release create "v${VER}" -R "${REPO}" --title "v${VER}" --notes "Release v${VER}." \
  "pkgmanager-code-${VER}.zip" pkgmanager-code-latest.zip "pkgmanager-full-${VER}.zip" config.json \
  || gh release upload "v${VER}" -R "${REPO}" "pkgmanager-code-${VER}.zip" pkgmanager-code-latest.zip "pkgmanager-full-${VER}.zip" config.json --clobber

echo "== I4: attesa che raw serva la nuova versione, STABILE (max 15 min) =="
# Fastly ha POP multipli: una singola risposta OK non basta (v2.1.7: un POP
# serviva 2.1.7 e un altro ancora 2.1.6 -> l'utente non vedeva l'update).
# Richiesti 3 OK consecutivi su config.json + versione coerente su pkgmanager.js.
STREAK=0
for i in $(seq 1 60); do
  SERVED=$(curl -sL "$RAW" | python3 -c "import json,sys; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || true)
  JSVER=$(curl -sL "https://raw.githubusercontent.com/${REPO#github.com/}/main/pkgmanager.js" | grep -o "obj.version = '[0-9.]*'" | head -1 | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" || true)
  if [ "$SERVED" = "$VER" ] && [ "$JSVER" = "$VER" ]; then
    STREAK=$((STREAK+1))
    if [ "$STREAK" -ge 3 ]; then echo "raw OK stabile: v${VER} (3 OK consecutivi) dopo ${i}x15s"; exit 0; fi
    echo "raw OK ${STREAK}/3 (controllo ${i})..."
  else
    if [ "$STREAK" -gt 0 ]; then echo "raw FLAKY: era OK, di nuovo stale (serve: '${SERVED:-?}' js:'${JSVER:-?}')"; fi
    STREAK=0
    echo "raw stale (serve: '${SERVED:-<niente>}' js: '${JSVER:-<niente>}'), riprovo tra 15s..."
  fi
  sleep 15
done
echo "ATTENZIONE: raw NON serve ancora v${VER} in modo stabile (cache Fastly). NON dichiarare l'update disponibile all'utente finche' raw non si allinea."
exit 1
