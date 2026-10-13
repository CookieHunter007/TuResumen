// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// Lee cada PDF de muestras/ con los lectores y verifica que los saldos cuadren.
// Uso: npm install && npm test   (los PDF de muestras/ no se suben al repo)
'use strict';

const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

require('../js/lectores/comun.js');
require('../js/lectores/bbva.js');
const { leerResumen } = globalThis.TuResumen;

async function paginasDe(archivo) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(archivo)), verbosity: 0 }).promise;
  const paginas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    paginas.push(tc.items.map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str })));
  }
  return paginas;
}

const cerca = (a, b) => Math.abs(a - b) < 0.02;

(async () => {
  const dir = path.join(__dirname, '..', 'muestras');
  const pdfs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')) : [];
  if (!pdfs.length) { console.log('No hay PDF en muestras/. Copiá ahí algunos resúmenes para probar.'); return; }
  let fallas = 0;
  for (const f of pdfs) {
    try {
      const r = leerResumen(await paginasDe(path.join(dir, f)));
      const suma = r.movs.reduce((a, m) => ({ ars: a.ars + m.ars, usd: a.usd + m.usd }), { ...r.saldoAnt });
      const consumos = r.movs.filter((m) => m.tipo === 'consumo').reduce((a, m) => a + m.ars, 0);
      const ok = r.cierre && cerca(suma.ars, r.saldoARS) && cerca(suma.usd, r.saldoUSD || 0) && cerca(consumos, r.totalesConsumo.ars);
      if (!ok) fallas++;
      console.log(`${ok ? 'OK   ' : 'FALLA'} ${f}: ${r.emisor} ${r.brand}, cierre ${r.cierre}, ${r.movs.length} movimientos, saldo $${r.saldoARS} / U$S${r.saldoUSD}` +
        (ok ? '' : ` (leído: $${suma.ars.toFixed(2)} / U$S${suma.usd.toFixed(2)})`));
    } catch (e) {
      fallas++;
      console.log(`FALLA ${f}: ${e.message}`);
    }
  }
  process.exitCode = fallas ? 1 : 0;
})();
