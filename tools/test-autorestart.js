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

console.log(ok ? 'AUTORESTART OK' : 'FALLITO');
process.exit(ok ? 0 : 1);
