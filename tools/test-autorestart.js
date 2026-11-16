// test-autorestart.js — pkgAutoRestartCheck: restart only when the on-disk
// config.json version differs from the running one, honor autoRestartOnUpdate,
// debounce double-schedules. No real timers / exits in the test.
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgm-ar-'));
const cfgPath = path.join(tmp, 'config.json');
const parent = { fs, path, parent: { datapath: tmp, config: {} }, db: { getPlugins: (cb) => cb(null, []) } };
const obj = require('../pkgmanager.js').pkgmanager(parent);
obj.pkgLocalConfigPath = cfgPath;
obj.pkgConfigInvariantCheck = () => { }; // isolate from network/paths
obj.syncStoreLinks = () => { };

function withCapturedTimer(fn) {
  const realSetTimeout = global.setTimeout; let captured = null;
  global.setTimeout = function (f, ms) { captured = { f, ms }; return 0; };
  try { fn(); } finally { global.setTimeout = realSetTimeout; }
  return captured;
}

let ok = true;
function check(name, cond) { if (!cond) { console.error('FAIL: ' + name); ok = false; } else { console.log('ok: ' + name); } }

// 1) disk version != running -> restart scheduled in 2000ms
fs.writeFileSync(cfgPath, JSON.stringify({ version: '9.9.9' }));
let cap = withCapturedTimer(() => obj.pkgAutoRestartCheck());
check('restart schedulato con versione diversa', cap && cap.ms === 2000);

// 2) equal versions -> no restart (fresh obj; reset debounce flag)
obj.pkgRestartScheduled = false;
fs.writeFileSync(cfgPath, JSON.stringify({ version: obj.version }));
cap = withCapturedTimer(() => obj.pkgAutoRestartCheck());
check('nessun restart con versioni uguali', cap === null);

// 3) autoRestartOnUpdate:false -> no restart even with different version
fs.writeFileSync(cfgPath, JSON.stringify({ version: '9.9.9', autoRestartOnUpdate: false }));
cap = withCapturedTimer(() => obj.pkgAutoRestartCheck());
check('opt-out autoRestartOnUpdate rispettato', cap === null);

// 4) debounce: second call while already scheduled -> no double timer
obj.pkgRestartScheduled = false;
fs.writeFileSync(cfgPath, JSON.stringify({ version: '9.9.9' }));
withCapturedTimer(() => obj.pkgAutoRestartCheck());
cap = withCapturedTimer(() => obj.pkgAutoRestartCheck());
check('debounce: nessun doppio schedulo', cap === null);

// 5) stand-down: un modulo vecchio left behind da reloadplugin non riavvia
// (la versione attiva e' quella del modulo nuovo)
obj.pkgRestartScheduled = false;
globalThis.__pkgmanagerActiveVersion = '9.9.9'; // il modulo nuovo (9.9.9) e' gia' attivo: il vecchio sta ZONA
fs.writeFileSync(cfgPath, JSON.stringify({ version: '9.9.9' }));
cap = withCapturedTimer(() => obj.pkgAutoRestartCheck());
check('stand-down: modulo vecchio dopo reloadplugin non riavvia', cap === null);
delete globalThis.__pkgmanagerActiveVersion;

// 6) self-update (pluginInstallUpdate): scrive pkgmanager.js, allinea
// config.json alla nuova versione e schedula restart via canale launcher
const vm = require('vm');
const plugDir = path.join(tmp, 'plugins', 'pkgmanager');
fs.mkdirSync(plugDir, { recursive: true });
fs.writeFileSync(path.join(plugDir, 'pkgmanager.js'), 'obj.version = \'0.0.1\';');
obj.pkgLocalConfigPath = path.join(plugDir, 'config.json');
fs.writeFileSync(obj.pkgLocalConfigPath, JSON.stringify({ version: '0.0.1', configUrl: 'x' }));
obj.replyCatalog = () => { };
let sent = null;
const newCode = "obj.version = '7.7.7'; // x";
cap = withCapturedTimer(() => obj.pluginInstallUpdate(newCode, null, { send: (m) => { sent = m; } }));
const diskCfg = JSON.parse(fs.readFileSync(obj.pkgLocalConfigPath));
check('self-update: config.json allineato', diskCfg.version === '7.7.7' && diskCfg.configUrl === 'x');
check('self-update: restart via launcher schedulato a 3s', cap && cap.ms === 3000);
check('self-update: ack inviato', sent && sent.method === 'pkgUpdateApplied');

// 7) self-update: downgrade rifiutato
sent = null;
cap = withCapturedTimer(() => obj.pluginInstallUpdate("obj.version = '1.0.0';", null, { send: (m) => { sent = m; } }));
check('self-update: downgrade rifiutato (no timer, no ack ok)', cap === null);

console.log(ok ? 'AUTORESTART OK' : 'FALLITO');
process.exit(ok ? 0 : 1);
