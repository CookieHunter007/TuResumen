// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// Lector: tarjetas de crédito BBVA Argentina (Visa y Mastercard).
//
// Formato verificado con resúmenes "Premium World" de octubre 2026.
// El PDF trae el texto con posiciones: las columnas se reconocen por coordenada x
// (pesos a partir de x≈430, dólares a partir de x≈520, cupón entre 370 y 440).
'use strict';

(function (root) {
  const { num, ES_IMPORTE, fechaCorta, renglones, comercio, MESES_LARGOS } = root.TuResumen.util;

  const X_IMPORTE = 430;
  const X_DOLARES = 520;

  /** Valores debajo de una fila de títulos: cada valor va al título más cercano a su izquierda. */
  function valoresBajo(filas, patron, titulos) {
    for (let i = 0; i < filas.length; i++) {
      if (!patron.test(filas[i].text)) continue;
      const xs = titulos.map((t) => { const it = filas[i].items.find((x) => x.s.toUpperCase().startsWith(t)); return it ? it.x : null; });
      const out = {};
      const y0 = filas[i].y;
      for (let j = i + 1; j < filas.length && filas[j].y > y0 - 22; j++) {
        for (const it of filas[j].items) {
          let k = -1;
          xs.forEach((x, n) => { if (x != null && x <= it.x + 8 && (k < 0 || x > xs[k])) k = n; });
          if (k >= 0) out[titulos[k]] = ((out[titulos[k]] || '') + ' ' + it.s).trim();
        }
      }
      return out;
    }
    return {};
  }

  function importes(fila) {
    const r = { ars: 0, usd: 0 };
    for (const t of fila.items) {
      if (t.x >= X_IMPORTE && ES_IMPORTE.test(t.s.trim())) {
        if (t.x >= X_DOLARES) r.usd += num(t.s); else r.ars += num(t.s);
      }
    }
    return r;
  }

  function leer(paginas) {
    const porPagina = paginas.map((p) => renglones(p));
    const p1 = porPagina[0] || [];
    const todas = porPagina.flat();
    const texto = todas.map((r) => r.text).join('\n');

    const st = {
      tipo: 'tarjeta', brand: null, card: null, cuenta: null,
      cierre: null, vencimiento: null, cierreAnt: null, proxCierre: null, proxVenc: null,
      saldoARS: null, saldoUSD: null, minimo: null, tnaARS: null,
      saldoAnt: { ars: 0, usd: 0 }, totalesConsumo: { ars: 0, usd: 0 },
      cuotasFuturas: [], movs: [],
    };

    const filaCuenta = p1.find((r) => /\bcuenta\s+\d+/.test(r.text));
    if (filaCuenta) { const m = /^(.*?)\s+cuenta\s+(\d+)/.exec(filaCuenta.text); st.card = m[1].trim(); st.cuenta = m[2]; }
    const ref = st.card || texto.slice(0, 400);
    st.brand = /visa/i.test(ref) ? 'Visa' : /master/i.test(ref) ? 'Mastercard' : /amex|american/i.test(ref) ? 'American Express' : (st.card || 'Tarjeta');

    const enc = valoresBajo(p1, /CIERRE ACTUAL/, ['CIERRE ACTUAL', 'VENCIMIENTO ACTUAL', 'SALDO ACTUAL $', 'SALDO ACTUAL U$S', 'PAGO M']);
    st.cierre = fechaCorta(enc['CIERRE ACTUAL'] || '');
    st.vencimiento = fechaCorta(enc['VENCIMIENTO ACTUAL'] || '');
    if (enc['SALDO ACTUAL $']) st.saldoARS = num(enc['SALDO ACTUAL $']);
    if (enc['SALDO ACTUAL U$S']) st.saldoUSD = num(enc['SALDO ACTUAL U$S']);
    if (enc['PAGO M']) st.minimo = num(enc['PAGO M']);

    const otros = valoresBajo(p1, /CIERRE ANTERIOR/, ['CIERRE ANTERIOR', 'VENCIMIENTO ANTERIOR', 'PR']);
    st.cierreAnt = fechaCorta(otros['CIERRE ANTERIOR'] || '');
    const prox = (otros['PR'] || '').split(' ').map(fechaCorta).filter(Boolean);
    st.proxCierre = prox[0] || null;
    st.proxVenc = prox[1] || null;

    const tna = /TNA \$[\s\S]{0,40}?(\d+,\d+)\s?%/.exec(texto);
    if (tna) st.tnaARS = num(tna[1]);

    // Cuotas a vencer: fila de meses ("OCTUBRE/26 ...") con los importes debajo.
    const MES = /^(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\/(\d\d)$/;
    for (let i = 0; i < p1.length; i++) {
      const meses = p1[i].items.filter((t) => MES.test(t.s.trim()));
      if (meses.length < 2) continue;
      const vals = [];
      for (let j = i + 1; j < p1.length && p1[j].y > p1[i].y - 26; j++) {
        for (const t of p1[j].items) { const s = t.s.replace(/\$/g, '').trim(); if (/^[\d.]+,\d{2}$/.test(s)) vals.push({ x: t.x, v: num(s) }); }
      }
      vals.sort((a, b) => a.x - b.x);
      meses.forEach((m, k) => {
        const mm = MES.exec(m.s.trim());
        const n = MESES_LARGOS.indexOf(mm[1]) + 1 || 9;
        if (vals[k]) st.cuotasFuturas.push({ mes: `20${mm[2]}-${String(n).padStart(2, '0')}`, monto: vals[k].v });
      });
      break;
    }
    const resto = /A partir de\s+([A-Za-zé]+)\/(\d\d)\s+\$\s*([\d.]+,\d{2})/i.exec(texto.replace(/\n/g, ' '));
    if (resto) {
      const n = MESES_LARGOS.indexOf(resto[1].toUpperCase()) + 1;
      if (n) st.cuotasFuturas.push({ mes: `20${resto[2]}-${String(n).padStart(2, '0')}`, monto: num(resto[3]), resto: true });
    }

    // Cuadro resumen de la primera página: saldo anterior y totales de consumos.
    for (const r of p1) {
      if (r.text === 'DETALLE') break;
      if (/^SALDO ANTERIOR/.test(r.text)) st.saldoAnt = importes(r);
      if (/^TOTAL CONSUMOS/.test(r.text)) { const v = importes(r); st.totalesConsumo.ars += v.ars; st.totalesConsumo.usd += v.usd; }
    }

    // Detalle de movimientos.
    let seccion = null;
    let enDetalle = false;
    for (const r of todas) {
      const T = r.text;
      if (T === 'DETALLE') { enDetalle = true; continue; }
      if (!enDetalle) continue;
      if (/^Sus pagos y ajustes/i.test(T)) { seccion = 'pago'; continue; }
      if (/^Consumos\s/.test(T)) { seccion = 'consumo'; continue; }
      if (/^Impuestos, cargos e intereses/i.test(T)) { seccion = 'impuesto'; continue; }
      if (/^Legales y avisos/i.test(T)) { seccion = null; enDetalle = false; continue; }
      if (!seccion) continue;

      const primero = r.items[0];
      const fecha = primero && primero.x < 105 ? fechaCorta(primero.s) : null;
      if (!fecha) continue;

      const desc = [];
      const m = { ars: 0, usd: 0 };
      let cupon = null;
      for (const t of r.items.slice(1)) {
        const s = t.s.trim();
        if (t.x >= X_IMPORTE && ES_IMPORTE.test(s)) { if (t.x >= X_DOLARES) m.usd += num(s); else m.ars += num(s); continue; }
        if (t.x >= 370 && t.x < 440 && /^\d{3,}$/.test(s)) { cupon = s; continue; }
        if (t.x < 440) desc.push(s);
      }
      let d = desc.join(' ').replace(/\s+/g, ' ').trim();
      let cuota = null;
      const c = /\bC\.(\d{1,2})\/(\d{1,2})\b/.exec(d);
      if (c) { cuota = { n: +c[1], de: +c[2] }; d = d.replace(c[0], '').trim(); }
      const u = /(\d*)USD\s+([\d.]+,\d{2})\s*$/.exec(d);
      if (u) d = d.slice(0, u.index).trim();

      let tipo = seccion;
      if (seccion === 'pago') tipo = /^SU PAGO/i.test(d) ? 'pago' : 'credito';
      if (seccion === 'impuesto' && /^CR\./.test(d)) tipo = 'credito';
      st.movs.push({
        fecha, desc: d, cupon, cuota, tipo,
        ars: Math.round(m.ars * 100) / 100,
        usd: Math.round(m.usd * 100) / 100,
        key: tipo === 'consumo' ? comercio(d) : d,
      });
    }
    return st;
  }

  root.TuResumen.registrarLector({
    id: 'bbva',
    nombre: 'BBVA',
    detalle: 'tarjetas Visa y Mastercard',
    reconoce: (texto) => /Banco BBVA Argentina/i.test(texto) || (/BBVA/i.test(texto) && /CIERRE ACTUAL/.test(texto)),
    leer,
  });
})(typeof self !== 'undefined' ? self : globalThis);
