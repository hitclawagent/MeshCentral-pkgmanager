// test-vercmp.js — Debian version comparator vs dpkg (uses dpkg when present,
// asserts the pure-JS fallback matches; runs without network).
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgm-v-'));
const parent = { fs, path, parent: { datapath: tmp, config: {} } };
const mod = require('../pkgmanager.js');
mod.pkgmanager(parent);
const cmp = mod.verDebCmp;
let { execFileSync } = require('child_process');
let dpkgGe = null;
try { execFileSync('dpkg', ['--version'], { stdio: 'ignore' }); dpkgGe = (a, b) => { try { execFileSync('dpkg', ['--compare-versions', a, 'ge', b], { stdio: 'ignore' }); return true; } catch (e) { return false; } }; } catch (e) { }
const pairs = [
  // [a, b, aGeB] — truth calcolata da dpkg (e per casi noti, hard-coded)
  ['2:9.1.2141-1ubuntu4.10', '2:9.1.2141-1ubuntu4.9', true],   // il caso xxd: 4.10 > 4.9 (stringa dice il contrario)
  ['4.10', '4.9', true],
  ['1:1.0', '2:0.9', false],
  ['1.0~rc1', '1.0', false],
  ['1.0', '1.0~rc1', true],
  ['2.0.0', '2.0.0-1ubuntu1', false],
  ['9.1.1000', '9.1.999', true],
  ['1.2.3-1', '1.2.3', true],
  ['1.2.3b', '1.2.3', true],
  ['1.2.3a', '1.2.3b', false],
  ['1.0ubuntu1', '1.0', true],
  ['1.0-1ubuntu0.1', '1.0-1', true],
  ['1:0', '0.9', true],
  ['0.9.9', '1.0', false],
  ['1.0+a', '1.0', true],
  ['1.0+a', '1.0+b', false],
  ['2:9.1.0865-1ubuntu1.1', '2:9.1.0865-1ubuntu1', true],
  ['1.0.1-2', '1.0.1-10', false],
];
let ok = true;
for (const [a, b, expect] of pairs) {
  const mine = (cmp(a, b) >= 0);
  if (mine !== expect) { console.error('FAIL: ' + a + ' ge ' + b + ' → js:' + mine + ', atteso:' + expect); ok = false; }
  if (dpkgGe) { const dp = dpkgGe(a, b); if (dp !== expect) { console.error('ANOMALIA DPKG (segnala a chi mantiene): ' + a + ' ge ' + b + ' → ' + dp); } }
}
console.log(ok ? 'verDebCmp OK (' + pairs.length + ' casi)' : 'FALLITO');
process.exit(ok ? 0 : 1);
