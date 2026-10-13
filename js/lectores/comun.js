// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// Herramientas compartidas por los lectores de resúmenes y registro de lectores.
//
// Cada emisor (banco, tarjeta, billetera) tiene su propio archivo en js/lectores/
// que llama a TuResumen.registrarLector({...}). La app prueba cada lector con el
// texto del PDF y usa el primero que lo reconoce.
'use strict';

(function (root) {
  const TR = root.TuResumen = root.TuResumen || {};
  const lectores = [];

  const MESES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 };
  const MESES_LARGOS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  /** Importe con formato argentino ("1.234,56", "-12,00", "80871,27-") a número. */
  function num(s) {
    s = String(s).replace(/[$\s]/g, '');
    let neg = false;
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return neg ? -v : v;
  }
  const ES_IMPORTE = /^-?\$?\s?[\d.]+,\d{2}-?$/;

  /** "01-Oct-26" → "2026-10-01". */
  function fechaCorta(s) {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(String(s).trim());
    if (!m) return null;
    const mes = MESES[m[2].toUpperCase()];
    if (!mes) return null;
    return `20${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  /** Agrupa los fragmentos de texto de una página en renglones (de arriba hacia abajo). */
  function renglones(items, tolerancia = 3) {
    const its = items.filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    const filas = [];
    for (const it of its) {
      const ult = filas[filas.length - 1];
      if (ult && Math.abs(ult.y - it.y) <= tolerancia) ult.items.push(it);
      else filas.push({ y: it.y, items: [it] });
    }
    for (const f of filas) {
      f.items.sort((a, b) => a.x - b.x);
      f.text = f.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
    }
    return filas;
  }

  /** Nombre de comercio normalizado, para agrupar ("DLO*PRIMEVIDEO" y "PrimeVideo" → "PRIMEVIDEO"). */
  function comercio(d) {
    let s = d.toUpperCase().replace(/\s+/g, ' ').trim();
    s = s.replace(/^(DLO|MERPAGO|PAYU\*AR|PAYU|WL|MP|DLOCAL|EBANX|PAYPAL)\s?\*\s?/, '');
    if (/^PEDIDOSYA/.test(s)) return /PROPINA/.test(s) ? 'PEDIDOSYA PROPINA' : /MARKET/.test(s) ? 'PEDIDOSYA MARKET' : 'PEDIDOSYA';
    s = s.replace(/^GOOGLE \*/, 'GOOGLE ').replace(/\.COM(\.AR)?$/, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^PRIME ?VIDEO/.test(s)) return 'PRIMEVIDEO';
    if (/^STEAM/.test(s)) return 'STEAM';
    if (/^MICROSOFT/.test(s)) return 'MICROSOFT';
    return s;
  }

  /**
   * Registra un lector. Forma esperada:
   * {
   *   id: 'bbva', nombre: 'BBVA', detalle: 'Visa y Mastercard',
   *   reconoce(texto) -> boolean,   // texto plano de las primeras páginas
   *   leer(paginas)  -> Resumen     // paginas = [[{x, y, s}]] de PDF.js
   * }
   */
  function registrarLector(lector) {
    if (!lector || !lector.id || typeof lector.reconoce !== 'function' || typeof lector.leer !== 'function') {
      throw new Error('Lector inválido');
    }
    lectores.push(lector);
  }

  function textoPlano(paginas, max = 2) {
    return paginas.slice(0, max).map((p) => renglones(p).map((r) => r.text).join('\n')).join('\n');
  }

  class ResumenNoReconocido extends Error {}

  /** Elige el lector que reconoce el PDF y devuelve el resumen leído. */
  function leerResumen(paginas) {
    const texto = textoPlano(paginas);
    const lector = lectores.find((l) => l.reconoce(texto));
    if (!lector) throw new ResumenNoReconocido('No hay un lector para este resumen');
    const r = lector.leer(paginas);
    r.lector = lector.id;
    r.emisor = r.emisor || lector.nombre;
    return r;
  }

  TR.util = { num, ES_IMPORTE, fechaCorta, renglones, comercio, MESES_LARGOS };
  TR.registrarLector = registrarLector;
  TR.lectores = lectores;
  TR.leerResumen = leerResumen;
  TR.ResumenNoReconocido = ResumenNoReconocido;
})(typeof self !== 'undefined' ? self : globalThis);
