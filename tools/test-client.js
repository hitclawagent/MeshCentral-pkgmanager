// test-client.js — simulation END-TO-END of pkgOsScan (client side) with the REAL module + browser stubs.
// Regression: in v2.0.2/v2.0.3/v2.0.4 pkgOsScan crashed silently (pkgD2Pending called before allids
// existed + dead reference to d2runPending): the scan did NOTHING with no visible error.
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgm-test-'));
const parent = { fs, path, parent: { datapath: tmp, config: {}, db: { getPlugins: (cb)=>cb(null,[]) } } };
const obj = require('../pkgmanager.js').pkgmanager(parent);

const sent = [];
global.nodes = [
  { _id:'node/linux1', conn:1, name:'linux1', os_title:'Ubuntu 24.04' },
  { _id:'node/win1', conn:1, name:'win1', os_title:'', agent:{ id:4 } }, // Windows by agent id (v2.0.1 fix)
];
global.meshserver = { send: (m) => sent.push(m) };
global.window = {};
global.document = { getElementById: () => ({ innerHTML:'', textContent:'' }) };
global.pluginHandler = { pkgmanager: obj };
global.EscapeHtml = (x) => String(x);
const realSetTimeout = global.setTimeout; global.setTimeout = () => 0; // no poll chain
const realFetch = global.fetch; global.fetch = undefined;

obj.pkgOsScan();
const rid = global.window.pkgmanagerOsScan.rid;
const pend = global.window.pkgmanagerD2[rid];
if (!rid || !pend || pend.nodes.length !== 2) { console.error('FAIL: pending non creato correttamente'); process.exit(1); }
if (sent.length !== 2 || sent[0].type !== 3 || sent[1].type !== 2) { console.error('FAIL: comandi per-OS non inviati correttamente: ' + JSON.stringify(sent.map(m=>m.type))); process.exit(1); }
obj.pkgD2Receive({action:'msg', type:'runcommands', responseid:rid, nodeid:'node/linux1', result:'__osinfo:Ubuntu|24.04|noble\nbash 5.2'});
obj.pkgD2Receive({action:'runcommands', responseid:rid, result:'Agent not connected'});
if (!pend.results['node/linux1'] || pend.results['node/win1'] !== 'Agent not connected') { console.error('FAIL: risultati non raccolti'); process.exit(1); }
console.log('pkgOsScan end-to-end OK (rid ' + rid + ')');
process.exit(0);
