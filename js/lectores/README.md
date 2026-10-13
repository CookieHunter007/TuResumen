# Lectores de resúmenes

Cada emisor (banco, tarjeta, billetera) tiene su propio archivo. La app prueba cada lector con el texto del PDF y usa el primero que lo reconoce.

| Archivo     | Emisor | Productos                       |
|-------------|--------|---------------------------------|
| `bbva.js`   | BBVA   | Tarjetas Visa y Mastercard      |

## Agregar un emisor nuevo

1. Crear `js/lectores/<emisor>.js` que llame a `TuResumen.registrarLector({ id, nombre, detalle, reconoce, leer })`.
   - `reconoce(texto)` recibe el texto plano de las dos primeras páginas y devuelve `true` si el PDF es de ese emisor.
   - `leer(paginas)` recibe las páginas como `[[{ x, y, s }]]` (texto de PDF.js con su posición) y devuelve un resumen.
2. Sumar el `<script>` en `index.html` (después de `comun.js`), el archivo en `sw.js` (`APP_SHELL`) y en `tests/leer-muestras.js`.
3. Guardar PDF de ejemplo en `muestras/` (no se suben al repo) y correr `npm test`.

## Formato del resumen

```js
{
  tipo: 'tarjeta',
  brand: 'Visa',              // marca de la tarjeta
  card: 'Visa Signature',     // nombre del producto
  cuenta: '1234',             // solo los últimos 4 dígitos se guardan
  cierre: '2026-10-01', vencimiento: '2026-10-09',
  cierreAnt, proxCierre, proxVenc,
  saldoARS: 584539.71, saldoUSD: 12.43, minimo: 68360,
  saldoAnt: { ars, usd },     // para el control de lectura
  totalesConsumo: { ars, usd },
  cuotasFuturas: [{ mes: '2026-11', monto: 348500, resto?: true }],
  movs: [{
    fecha: '2026-09-17', desc: 'DLO*PRIMEVIDEO', key: 'PRIMEVIDEO',
    tipo: 'consumo' | 'pago' | 'credito' | 'impuesto',
    ars: 13308.79, usd: 0, cuota: { n: 4, de: 6 } | null, cupon,
  }],
}
```

El control de lectura verifica que `saldoAnt + suma(movs) = saldoARS / saldoUSD`. Si un lector nuevo cuadra con varios resúmenes reales, está listo.
