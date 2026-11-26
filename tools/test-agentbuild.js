// test-agentbuild.js — serveraction agentbuildinfo: core status passthrough,
// disk scan (agentbuilds/ + agents/), gating admin, graceful senza agentDefaults.
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgm-ab-'));
const parent = { fs, path, parent: { datapath: tmp, config: { settings: { plugins: {} } } }, db: { getPlugins: (cb) => cb(null, []) } };
const obj = require('../pkgmanager.js').pkgmanager(parent);
let ok = true;
function check(n, c) { if (!c) { console.error('FAIL: ' + n); ok = false; } else { console.log('ok: ' + n); } }

fs.mkdirSync(path.join(tmp, 'agentbuilds', 'v1.2.3'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'agentbuilds', 'v1.2.3', 'meshagent_linux_x64'), 'X'.repeat(1000000));
fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'agents', 'meshagent_signed.exe'), 'Y'.repeat(500000));

parent.parent.agentDefaults = {
  status: () => ({
    busy: true, enabled: true, errors: ['GitHub non raggiungibile'],
    updates: { enabled: true, repositories: [] },
    files: [
      { filename: 'meshagent_linux_x64', tag: 'v1.2.3', size: 4000000, status: 'Downloading', received: 1000000 },
      { filename: 'MeshCentralAssistant.exe', tag: 'v1.2.3', size: 1000000, status: 'Ready' },
      { filename: 'meshagent_arm64', tag: 'v1.2.3', size: 3000000, status: 'Unavailable', error: 'Automatic downloads are disabled.' }
    ]
  })
};

let sent = null, denied = null;
obj.serveraction({ pluginaction: 'agentbuildinfo', userid: 'admin' }, { user: { siteadmin: 0xFFFFFFFF }, send: (m) => { sent = m; } }, {});
check('admin: reply pkgAgentBuild', (sent != null) && (sent.method === 'pkgAgentBuild'));
check('core status letto', (sent.info.core != null) && sent.info.core.busy && (sent.info.core.files.length === 3));
check('errore core incluso', sent.info.core.errors[0].includes('GitHub'));
const abDir = sent.info.disk.find(d => d.dir === 'agentbuilds');
check('disco: file cache in agentbuilds/', (abDir != null) && abDir.items.some(i => (!i.dir) && (i.name === 'meshagent_linux_x64') && (i.size === 1000000)));
const agDir = sent.info.disk.find(d => d.dir === 'agents');
check('disco: override agents/', (agDir != null) && agDir.items.some(i => (i.name === 'meshagent_signed.exe') && (i.size === 500000)));

parent.parent.agentDefaults = null;
sent = null;
obj.serveraction({ pluginaction: 'agentbuildinfo', userid: 'admin' }, { user: { siteadmin: 0xFFFFFFFF }, send: (m) => { sent = m; } }, {});
check('core assente: core=null ma disco presente', (sent != null) && (sent.info.core === null) && (sent.info.disk.length === 2));

obj.serveraction({ pluginaction: 'agentbuildinfo', userid: 'guest' }, { user: { siteadmin: 0 }, send: (m) => { denied = m; } }, {});
check('non-admin: pkgDenied', (denied != null) && (denied.method === 'pkgDenied'));

console.log(ok ? 'AGENTBUILD OK' : 'FALLITO');
process.exit(ok ? 0 : 1);
