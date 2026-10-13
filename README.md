# Mis Tarjetas BBVA

Dashboard para leer los resúmenes de tarjeta de crédito de BBVA Argentina (Visa y Mastercard) en PDF.

Todo se procesa en el navegador con [PDF.js](https://mozilla.github.io/pdf.js/): los archivos no se suben a ningún servidor.

## Qué muestra

- Total a pagar en pesos y dólares, vencimiento y pago mínimo
- Gasto por categoría y comercios donde más gastaste
- Cuotas a vencer mes a mes y avance de cada plan
- Impuestos y percepciones (IVA RG 4240, IIBB, RG 5617) y sus devoluciones
- Tabla de movimientos con buscador y categorías editables (se guardan en el navegador)
- Control de lectura: verifica que saldo anterior + movimientos = saldo actual

## Uso

Abrí https://cookiehunter007.github.io/tarjetas-bbva/ y subí o arrastrá uno o más resúmenes en PDF.

### Instalarla en el teléfono

Es una app web instalable (PWA): queda con ícono propio, abre a pantalla completa y funciona sin conexión.

- **Android (Chrome):** abrí el enlace y tocá **Instalar** en el aviso de la app, o en el menú ⋮ → **Instalar app**. Una vez instalada, podés compartir un PDF desde otra app (Descargas, Gmail, la app de BBVA) y elegir **Mis Tarjetas**.
- **iPhone (Safari):** abrí el enlace, tocá **Compartir** → **Agregar a inicio**.

## Estructura

```
index.html        Estructura de la página
css/styles.css    Estilos (tema claro y oscuro)
js/parser.js      Lector de resúmenes BBVA a partir del texto del PDF
js/app.js         Interfaz: carga de archivos, filtros, gráficos y tabla
js/vendor/        PDF.js 3.11.174 (Mozilla, licencia Apache 2.0)
sw.js             Service worker: uso sin conexión y PDF compartidos
manifest.webmanifest  Datos de la app instalable
icons/            Íconos de la app
```

`js/parser.js` también se puede usar desde Node: `const { parseStatement } = require('./js/parser.js')`.

Los PDF y archivos `.json` están en `.gitignore` para no subir datos personales.

## Licencia

© 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados. Ver [LICENSE](LICENSE).
