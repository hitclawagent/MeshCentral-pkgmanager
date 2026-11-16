// test-osfetch.js — simulation of the SERVER osfetch flow (per-codename bundles,
// per-package max-version union). Uses a fake vendor index: no network.
// Machines: two Ubuntu resolute machines at DIFFERENT levels + one noble.
// Expected: TWO bundles (os-updates-resolute, os-updates-noble), the resolute
// bundle contains the max version of every missing package (union), install
// command is ONE dpkg call with all debs.
const fs = require('fs'), path = require('path'), os = require('os');
const zlib = require('zlib');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgm-of-'));
const parent = { fs, path, zlib, crypto: require('crypto'), parent: { datapath: tmp, config: {} } };
const obj = require('../pkgmanager.js').pkgmanager(parent);

// fake Packages.gz index for resolute: pkgA 2.0, pkgB 1.5 (dep of pkgA), pkgC 3.1
function fakeIdx(entries) {
  let t = '';
  for (const [pkg, ver, deps, fn] of entries) {
    t += `Package: ${pkg}\nVersion: ${ver}\nArchitecture: amd64\n${deps ? 'Depends: ' + deps + '\n' : ''}Filename: pool/main/${pkg}/${pkg}_${ver}_amd64.deb\nSize: 1234\n\n`;
  }
  return zlib.gunzipSync(Buffer.from('x')).length >= 0 ? zlib.deflateSync(Buffer.from(t)) : null; // deflate not gzip; we stub fget instead
}
// Il server usa zlib.gunzipSync su fget(): fetch reale -> intercettiamo. Non
// possiamo monkeypatchare fetch dentro il modulo: qui testiamo l'unit di logica
// via serveraction con fetch stub globale DI NODE (il modulo usa fetch globale).
const idxResolute = [
  ['pkg-a', '2.0', '', 'pkg-a_2.0_amd64.deb'],
  ['pkg-b', '1.5', '', 'pkg-b_1.5_amd64.deb'],
  ['pkg-old', '9.9', '', 'pkg-old_9.9_amd64.deb'], // su macchina1 gia' 9.9 -> nessun update; macchina2 8.0 -> update a 9.9
];
const idxNoble = [['pkg-n', '1.0', '', 'pkg-n_1.0_amd64.deb']];
function gz(entries) {
  let t = '';
  for (const [pkg, ver, deps] of entries) {
    t += `Package: ${pkg}\nVersion: ${ver}\nArchitecture: amd64\n${deps ? 'Depends: ' + deps + '\n' : ''}Filename: pool/main/x/${pkg}_${ver}_amd64.deb\nSize: 1234\n\n`;
  }
  return require('zlib').gzipSync(Buffer.from(t));
}
const realFetch = global.fetch;
global.fetch = async function (url) {
  const u = String(url);
  const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); // Buffer pooling-safe
  const ok200 = (buf) => ({ ok: true, status: 200, arrayBuffer: async () => ab(buf), headers: { 'User-Agent': 'x' } });
  if (u.includes('resolute-security') || u.includes('resolute-updates')) {
    if (u.includes('/Packages.gz')) return ok200(gz(idxResolute));
    return ok200(new TextEncoder().encode('x'));
  }
  if (u.includes('noble-security') || u.includes('noble-updates')) {
    if (u.includes('/Packages.gz')) return ok200(gz(idxNoble));
    return ok200(new TextEncoder().encode('x'));
  }
  if (u.endsWith('.deb')) { return ok200(new TextEncoder().encode('DEB-' + u.slice(-40))); }
  return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
};

// cattura le azioni server successive (importmanifest -> save)
const replies = [];
const fakeSession = { send: (m) => { if ((m.method === 'pkgList') || (m.method === 'pkgOsPlan')) replies.push(m); }, user: { siteadmin: 4294967295, _id: 'user//test' }, userid: 'user//test' };
const fakeParent2 = {};
// catalogo iniziale vuoto
fs.mkdirSync(path.join(tmp, 'plugins', 'pkgmanager'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'plugins', 'pkgmanager', 'catalog.json'), JSON.stringify({ packages: [] }));
// admin fittizio
const savedServeraction = obj.serveraction;

obj.serveraction({
  pluginaction: 'osfetch',
  pkgid: 'os-updates',
  machines: [
    { id: 'node/m1', name: 'm1-fresh', os: 'linux', osInfo: { name: 'Ubuntu', version: '26.04', codename: 'resolute' }, items: ['pkg-a 1.0', 'pkg-old 9.9', 'libc6 2.0'] },
    { id: 'node/m2', name: 'm2-old', os: 'linux', osInfo: { name: 'Ubuntu', version: '26.04', codename: 'resolute' }, items: ['pkg-a 0.5', 'pkg-old 8.0', 'libc6 2.0'] },
    { id: 'node/m3', name: 'm3-noble', os: 'linux', osInfo: { name: 'Ubuntu', version: '24.04', codename: 'noble' }, items: ['pkg-n 0.5'] },
    { id: 'node/w1', name: 'w1', os: 'windows', osInfo: { name: 'Microsoft Windows 11 Pro', version: '25H2 (10.0.26300)' }, items: ['KB5051987 Update'] },
  ],
}, fakeSession, fakeParent2);

// attendi la catena asincrona
setTimeout(() => {
  const store = path.join(tmp, 'plugins', 'pkgmanager', 'store');
  const dirs = fs.readdirSync(store);
  console.log('store dirs:', dirs.join(', '));
  // v2.0.8: il piano arriva via pkgOsPlan su session.send
  const plans = replies.filter(m => m.method === 'pkgOsPlan').map(m => m.plan);
  console.log('piani ricevuti:', plans.length);
  let ok = plans.length === 1;
  const plan = plans[0];
  const res = plan.groups['resolute'];
  const nob = plan.groups['noble'];
  const win = plan.groups[Object.keys(plan.groups).find(k => k.startsWith('windows'))];
  if (!res || !nob || !win) { console.error('FAIL: gruppi mancanti'); ok = false; }
  if (res) {
    const a = res.updates.find(u => u.package === 'pkg-a');
    const oldp = res.updates.find(u => u.package === 'pkg-old');
    const dupA = res.updates.filter(u => u.package === 'pkg-a').length;
    if (!a || dupA !== 1) { console.error('FAIL: union max-version di pkg-a (dup=' + dupA + ')'); ok = false; }
    if (a && a.version !== '2.0') { console.error('FAIL: versione max attesa 2.0, trovata ' + a.version); ok = false; }
    if (!oldp || oldp.version !== '9.9') { console.error('FAIL: union pkg-old -> 9.9 per portare m2 al livello di m1'); ok = false; }
    if (a && a.inStore !== true) { console.error('FAIL: pkg-a dovrebbe essere inStore dopo osfetch'); ok = false; }
    if (a && !a.sha384) { console.error('FAIL: sha384 mancante per pkg-a'); ok = false; }
    if (!res.name) { }
    if (!res.storeDirName || res.storeDirName !== 'os-updates-resolute') { console.error('FAIL: storeDirName'); ok = false; }
    if (res.machNames.length !== 2) { console.error('FAIL: macchine del gruppo resolute = ' + res.machNames.length); ok = false; }
  }
  if (nob) { const n = nob.updates.find(u => u.package === 'pkg-n'); if (!n || n.inStore !== true) { console.error('FAIL: pkg-n inStore'); ok = false; } }
  if (win && win.os !== 'windows') { console.error('FAIL: gruppo windows'); ok = false; }
  // nessun bundle nel catalogo (v2.0.8: niente pkg kind:'os' creati da osfetch)
  const cat = JSON.parse(fs.readFileSync(path.join(tmp, 'plugins', 'pkgmanager', 'catalog.json')));
  if (cat.packages.filter(p => p.kind === 'os').length !== 0) { console.error('FAIL: osfetch non deve piu creare bundle nel catalogo'); ok = false; }
  // i deb sono nello store
  const debFiles = fs.readdirSync(path.join(store, 'os-updates-resolute')).filter(f => f.endsWith('.deb'));
  if (debFiles.length < 2) { console.error('FAIL: deb mancanti nello store: ' + debFiles.join(',')); ok = false; }
  console.log(ok ? 'OSFETCH END-TO-END OK (v2.0.8 piano)' : 'OSFETCH FALLITO');
  process.exit(ok ? 0 : 1);
}, 2500);
