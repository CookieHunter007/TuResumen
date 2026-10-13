// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// TuResumen · service worker: funciona sin conexión y recibe PDF compartidos desde otras apps (Android).
'use strict';

const VERSION = 'v2';
const APP_CACHE = `turesumen-${VERSION}`;
const FONT_CACHE = 'turesumen-fuentes';
const SHARE_CACHE = 'turesumen-compartidos';

const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/lectores/comun.js',
  './js/lectores/bbva.js',
  './js/app.js',
  './js/vendor/pdf.min.js',
  './js/vendor/pdf.worker.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('mis-tarjetas-') || (/^turesumen-v\d+$/.test(k) && k !== APP_CACHE))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // PDF compartido desde otra app: se guarda y se abre la app para procesarlo.
  if (req.method === 'POST' && url.pathname.endsWith('/compartir')) {
    event.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET') return;

  // Fuentes de Google: se usan las guardadas y se actualizan en segundo plano.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Archivos de la app: primero la red (para tener la última versión), y si no hay conexión, lo guardado.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

async function receiveShare(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('resumenes').filter((f) => f && typeof f.arrayBuffer === 'function');
    const cache = await caches.open(SHARE_CACHE);
    await Promise.all(files.map((f, i) => cache.put(
      `./compartido/${Date.now()}-${i}`,
      new Response(f, { headers: { 'Content-Type': 'application/pdf', 'X-Nombre': encodeURIComponent(f.name || 'resumen.pdf') } })
    )));
  } catch (e) {
    // Si falla, la app abre igual y el usuario puede subir el archivo a mano.
  }
  return Response.redirect('./?compartido=1', 303);
}
