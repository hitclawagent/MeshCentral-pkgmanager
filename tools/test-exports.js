// v2.2.16: INVARIANTE EXPORTS — due regole:
//  1) ogni funzione definita come obj.pkg* DEVE essere in obj.exports
//     (MeshCentral serializza al browser SOLO le funzioni elencate);
//  2) ogni funzione referenziata come pluginHandler.pkgmanager.<name>(...)
//     (onclick onchange onchange ecc. nel markup) DEVE essere in exports.
// Usato da release.sh; esce 0 se OK, 1 se violazione.
'use strict';
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'pkgmanager.js'), 'utf8');
const m = /obj\.exports = \[([^\]]+)\]/.exec(src);
if (m == null) { console.error('exports list not found'); process.exit(1); }
const exps = m[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''));
const missing = new Set();
for (const d of src.matchAll(/obj\.(pkg[A-Za-z0-9_]+)\s*=\s*function/g)) { if (!exps.includes(d[1])) { missing.add(d[1]); } }
for (const r of src.matchAll(/pluginHandler\.pkgmanager\.([A-Za-z0-9_]+)\(/g)) { if (!exps.includes(r[1])) { missing.add(r[1]); } }
if (missing.size > 0) { console.error('EXPORTS MANCANTI: ' + [...missing].join(', ')); process.exit(1); }
console.log('exports ok (' + exps.length + ' voci, ' + [...src.matchAll(/obj\.pkg[A-Za-z0-9_]+\s*=\s*function/g)].length + ' pkg* funzioni coperte)');
