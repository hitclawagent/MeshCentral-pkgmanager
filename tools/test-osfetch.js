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
const fakeSession = { send: (m) => { if (m.method === 'pkgList') replies.push(m); }, user: { siteadmin: 4294967295, _id: 'user//test' }, userid: 'user//test' };
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
  const cat = JSON.parse(fs.readFileSync(path.join(tmp, 'plugins', 'pkgmanager', 'catalog.json')));
  const bundles = cat.packages.filter(p => p.kind === 'os');
  console.log('bundles:', bundles.map(b => b.id + ' name="' + b.name + '" linux.artifacts=' + (b.linux ? b.linux.artifacts.length : 0)).join(' | '));
  let ok = true;
  const res = bundles.find(b => b.id === 'os-updates-resolute');
  const nob = bundles.find(b => b.id === 'os-updates-noble');
  if (!res || !nob) { console.error('FAIL: bundle per codename mancanti'); ok = false; }
  if (res) {
    const arts = res.linux.artifacts;
    // pkg-a presente UNA sola volta (max 2.0), pkg-old 9.9 (union: m2 8.0 -> 9.9), pkg-b dipendenza
    const hasA = arts.some(a => a.startsWith('pkg-a_2.0_'));
    const dupA = arts.filter(a => a.startsWith('pkg-a_')).length;
    const hasOld = arts.some(a => a.startsWith('pkg-old_9.9_'));
    if (!hasA || dupA !== 1) { console.error('FAIL: union max-version di pkg-a (dup=' + dupA + ')'); ok = false; }
    if (!hasOld) { console.error('FAIL: union pkg-old -> 9.9 per portare m2 al livello di m1'); ok = false; }
    // install = UN solo dpkg per tutti i deb
    const dpkgCalls = (res.linux.cmd.match(/dpkg -i /g) || []).length;
    if (dpkgCalls !== 1) { console.error('FAIL: install non è un solo dpkg (' + dpkgCalls + ')'); ok = false; }
    if (!res.linux.cmd.includes('dpkg -i /tmp/pkg-a_2.0_amd64.deb /tmp/pkg-old_9.9_amd64.deb')) { console.error('FAIL: dpkg non contiene i deb dell union'); ok = false; }
    if (res.linux.artifacts.some(a => a.startsWith('pkg-b_'))) { console.error('FAIL: pkg-b non dipendenza di nulla, non doveva esserci'); ok = false; }
    if (!res.name.includes('resolute')) { console.error('FAIL: nome senza codename: ' + res.name); ok = false; }
  }
  if (nob && nob.linux.artifacts.length !== 1) { console.error('FAIL: noble bundle atteso 1 file'); ok = false; }
  // i deb scaricati esistono nello store
  const resDir = path.join(store, 'os-updates-resolute');
  const debFiles = fs.readdirSync(resDir).filter(f => f.endsWith('.deb'));
  if (debFiles.length < 2) { console.error('FAIL: deb mancanti nello store: ' + debFiles.join(',')); ok = false; }
  console.log(ok ? 'OSFETCH END-TO-END OK' : 'OSFETCH FALLITO');
  process.exit(ok ? 0 : 1);
}, 2500);
