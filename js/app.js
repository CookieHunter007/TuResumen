// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// Interfaz del tablero: carga de PDF, filtros y render.
'use strict';

const LS='bbva-dash-v1';
const store={get(k,d){try{const v=localStorage.getItem(LS+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(LS+k,JSON.stringify(v))}catch(e){}}};
let statements = store.get(':st', []);
let catOverride = store.get(':cat', {});
let ui = {card:'all', period:null, q:''};

const CATS = [
  ['Delivery y comida', /PEDIDOSYA|RAPPI|KFC|MCDONALD|BURGER|TAPAS|RESTO|PARRILLA|PIZZ|CAFE|STARBUCKS|SUSHI|HELAD/],
  ['Suscripciones', /NETFLIX|PRIMEVIDEO|PRIME VIDEO|CRUNCHYROLL|YOUTUBE|SPOTIFY|DISNEY|HBO|\bMAX\b|MICROSOFT|ICLOUD|APPLE|PARAMOUNT|STAR ?\+|CHATGPT|OPENAI|CLAUDE|ANTHROPIC|GOOGLE/],
  ['Juegos', /STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC ?GAMES|RIOT/],
  ['Transporte', /UBER|DIDI|CABIFY|SUBTE|EMOVA|\bSUBE\b|YPF|SHELL|AXION|PUMA ENERG|PEAJE|AUSA|ESTACIONAM/],
  ['Viajes', /DESPEGAR|AEROLINEAS|LATAM|FLYBONDI|JETSMART|BOOKING|AIRBNB|HOTEL|ALMUNDO/],
  ['Supermercado', /COTO|CARREFOUR|\bDIA\b|JUMBO|DISCO|\bVEA\b|CHANGOMAS|LA ANONIMA|SUPERMERC/],
  ['Compras online', /MERCADOLIBRE|SAMSHOP|AMAZON|TIENDA|SHEIN|TEMU|ALIEXPRESS|FRAVEGA|GARBARINO|MUSIMUNDO/],
  ['Salud y mascotas', /VETERIN|FARMACIA|FARMACITY|PET|OSDE|SWISS MEDICAL|GALENO/],
  ['Salidas', /CINEMARK|HOYTS|CINE|TEATRO|TICKETEK|ALLACCESS|BAR\b/],
  ['Regalos y flores', /FLORES|FLORERIA|REGAL/],
];
const CAT_LIST=[...CATS.map(c=>c[0]),'Educación','Servicios','Otros'];
function catOf(m){ if(catOverride[m.key]) return catOverride[m.key]; const s=(m.key+' '+m.desc).toUpperCase(); for(const [c,re] of CATS) if(re.test(s)) return c; return 'Otros'; }

const fARS=new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fARS0=new Intl.NumberFormat('es-AR',{maximumFractionDigits:0});
const money=(v,dec=true)=>(v<0?'−':'')+'$ '+(dec?fARS:fARS0).format(Math.abs(v));
const fCompact=new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1});
const moneyShort=v=>fCompact.format(v).replace(/\s/g,'');
const usd=v=>(v<0?'−':'')+'U$S '+fARS.format(Math.abs(v));
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fdate=s=>{if(!s)return '—';const [y,m,d]=s.split('-');return `${+d} ${MES[m-1]} ${y.slice(2)}`};
const fmes=s=>{const [y,m]=s.split('-');return `${MES[m-1]} ${y.slice(2)}`};
const color=b=>b==='Visa'?'var(--visa)':'var(--mc)';
const brandClass=b=>b==='Visa'?'visa':'mc';
const sid=s=>`${s.brand}|${s.cuenta}|${s.cierre}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function niceDesc(d){ return d.replace(/^(DLO|MERPAGO|PAYU\*AR|PAYU|WL|MP)\s?\*\s?/i,'').replace(/\s+/g,' ').trim(); }
function taxGroup(d){ const u=d.toUpperCase();
  if(/^IIBB/.test(u)) return 'Percepción IIBB (CABA)';
  if(/RG 4240/.test(u)) return 'IVA servicios digitales (RG 4240)';
  if(/^DB\.?RG 5617|RG 5617/.test(u) && !/^CR/.test(u)) return 'Percepción 30% dólar (RG 5617)';
  if(/^CR\.?RG 5617/.test(u)) return 'Devolución percepción RG 5617';
  if(/INTERES/.test(u)) return 'Intereses'; if(/COMISION|MANTENIM/.test(u)) return 'Comisiones';
  return d; }

function save(){ store.set(':st',statements); }
function periods(){ return [...new Set(statements.map(s=>s.cierre))].sort().reverse(); }
function selected(){ const p=ui.period||periods()[0]; return statements.filter(s=>s.cierre===p && (ui.card==='all'||s.brand===ui.card)); }

function renderChips(){
  const el=document.getElementById('chips');
  if(!statements.length){ el.innerHTML='<span class="muted">Todavía no cargaste resúmenes. Podés arrastrar los PDF acá.</span>'; return; }
  el.innerHTML=statements.slice().sort((a,b)=>b.cierre.localeCompare(a.cierre)).map(s=>`<span class="chip"><span class="dot dot--${brandClass(s.brand)}"></span>${esc(s.card||s.brand)} ···${esc(String(s.cuenta).slice(-4))} · cierre ${fdate(s.cierre)}<button type="button" aria-label="Quitar resumen" data-rm="${esc(sid(s))}">×</button></span>`).join('');
}
function renderFilters(){
  const brands=[...new Set(statements.map(s=>s.brand))];
  const ps=periods(); if(ui.period && !ps.includes(ui.period)) ui.period=null;
  const p=ui.period||ps[0];
  document.getElementById('filters').innerHTML = statements.length? `
    <div class="seg" role="group" aria-label="Tarjeta">
      <button type="button" data-card="all" aria-pressed="${ui.card==='all'}">Todas</button>
      ${brands.map(b=>`<button type="button" data-card="${b}" aria-pressed="${ui.card===b}"><span class="dot dot--${brandClass(b)}"></span>${b}</button>`).join('')}
    </div>
    <span class="period"><label class="filter-label" for="period">Cierre</label>
    <select id="period">${ps.map(x=>`<option value="${x}" ${x===p?'selected':''}>${fdate(x)}</option>`).join('')}</select></span>` : '';
}

function render(){
  renderChips(); renderFilters();
  const main=document.getElementById('main');
  if(!statements.length){ main.innerHTML='<div class="panel empty">Subí uno o más resúmenes en PDF para ver el tablero: gastos por categoría, comercios, cuotas que vienen e impuestos.</div>'; return; }
  const sts=selected(); const brands=[...new Set(statements.map(s=>s.brand))];
  const movs=sts.flatMap(s=>s.movs.map(m=>({...m,brand:s.brand,stid:sid(s)})));
  const cons=movs.filter(m=>m.tipo==='consumo');
  const sum=(a,k)=>a.reduce((x,m)=>x+(m[k]||0),0);
  const saldoARS=sts.reduce((a,s)=>a+(s.saldoARS||0),0), saldoUSD=sts.reduce((a,s)=>a+(s.saldoUSD||0),0);
  const minimo=sts.reduce((a,s)=>a+(s.minimo||0),0);
  const venc=sts.map(s=>s.vencimiento).filter(Boolean).sort()[0];
  const prox=sts.map(s=>s.proxVenc).filter(Boolean).sort()[0];
  const cARS=sum(cons,'ars'), cUSD=sum(cons,'usd');
  const imp=movs.filter(m=>m.tipo==='impuesto'), cred=movs.filter(m=>m.tipo==='credito');
  const impARS=sum(imp,'ars'), credARS=sum(cred,'ars');
  const cuotasMov=cons.filter(m=>m.cuota); const cuotaARS=sum(cuotasMov,'ars');
  const futuro={}; for(const s of sts) for(const c of s.cuotasFuturas||[]){ const k=c.resto?'resto':c.mes; (futuro[k]??={mes:c.mes,resto:!!c.resto,by:{}}); futuro[k].by[s.brand]=(futuro[k].by[s.brand]||0)+c.monto; }
  const futList=Object.values(futuro).sort((a,b)=>(a.resto-b.resto)||a.mes.localeCompare(b.mes));
  const futTotal=futList.reduce((a,f)=>a+Object.values(f.by).reduce((x,y)=>x+y,0),0);

  // categories
  const cat={}; for(const m of cons){ const c=catOf(m); (cat[c]??={ars:{},usd:0,tot:0}); cat[c].ars[m.brand]=(cat[c].ars[m.brand]||0)+m.ars; cat[c].usd+=m.usd; cat[c].tot+=m.ars; }
  const catList=Object.entries(cat).sort((a,b)=>b[1].tot-a[1].tot||b[1].usd-a[1].usd);
  const catMax=Math.max(1,...catList.map(c=>c[1].tot));
  // merchants
  const mer={}; for(const m of cons){ (mer[m.key]??={name:niceDesc(m.desc),ars:{},usd:0,tot:0,n:0}); mer[m.key].ars[m.brand]=(mer[m.key].ars[m.brand]||0)+m.ars; mer[m.key].usd+=m.usd; mer[m.key].tot+=m.ars; mer[m.key].n++; }
  const merList=Object.values(mer).sort((a,b)=>b.tot-a.tot||b.usd-a.usd).slice(0,8);
  const merMax=Math.max(1,...merList.map(m=>m.tot));
  const stack=(o,max)=>brands.map((b,i)=>o[b]>0?`<span class="seg${b==='Visa'?1:2}" style="width:${(o[b]/max*100).toFixed(2)}%" title="${b}: ${money(o[b])}"></span>`:'').join('');
  const barRow=(lab,o,tot,u,max,extra='')=>`<div class="bar"><span class="lab" title="${esc(lab)}">${esc(lab)}${extra}</span><span class="track">${stack(o,max)}</span><span class="val">${tot?money(tot,false):''}${u?`<small>${tot?'+ ':''}${usd(u)}</small>`:''}</span></div>`;
  const legend=`<div class="legend">${brands.filter(b=>sts.some(s=>s.brand===b)).map(b=>`<span><span class="dot dot--${brandClass(b)}"></span>${b}</span>`).join('')}<span><span class="dot dot--usd"></span>En dólares</span></div>`;
  // taxes
  const tg={}; for(const m of [...imp,...cred]){ const g=taxGroup(m.desc); tg[g]=(tg[g]||0)+m.ars; }
  const tgList=Object.entries(tg).sort((a,b)=>b[1]-a[1]);
  // future columns
  const fMax=Math.max(1,...futList.map(f=>Object.values(f.by).reduce((x,y)=>x+y,0)));
  // checks
  const checks=sts.map(s=>{ const t=s.movs.reduce((a,m)=>({ars:a.ars+m.ars,usd:a.usd+m.usd}),{ars:(s.saldoAnt||{}).ars||0,usd:(s.saldoAnt||{}).usd||0});
    const ok=Math.abs(t.ars-s.saldoARS)<0.02 && Math.abs(t.usd-(s.saldoUSD||0))<0.02;
    const cs=s.movs.filter(m=>m.tipo==='consumo'); const okC=Math.abs(cs.reduce((a,m)=>a+m.ars,0)-s.totalesConsumo.ars)<0.02;
    return `<div><span class="dot dot--${brandClass(s.brand)}"></span> ${esc(s.card)}: ${ok&&okC?`<span class="ok">Cuadra</span> — saldo anterior + ${s.movs.length} movimientos = ${money(s.saldoARS)} y ${usd(s.saldoUSD||0)}, igual que el resumen.`:`<span class="bad">Revisar</span> — la suma leída da ${money(t.ars)} / ${usd(t.usd)} y el resumen dice ${money(s.saldoARS)} / ${usd(s.saldoUSD||0)}. Puede faltar algún movimiento.`}</div>`; }).join('');
  // table
  const q=ui.q.trim().toLowerCase();
  const rows=movs.filter(m=>!q||(m.desc+' '+catOf(m)).toLowerCase().includes(q)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const tipoLab={consumo:'',pago:'Pago',credito:'Crédito',impuesto:'Impuesto'};

  main.innerHTML=`
  <div class="stack-lg">
  <section class="kpis" aria-label="Resumen del período">
    <div class="kpi"><span class="eyebrow">A pagar</span><span class="v">${money(saldoARS)}</span><span class="s">${saldoUSD?`y <span class="num usd-text">${usd(saldoUSD)}</span>${saldoUSD<0?' a favor':''} · `:''}vence ${fdate(venc)}</span></div>
    <div class="kpi"><span class="eyebrow">Consumos del período</span><span class="v">${money(cARS,false)}</span><span class="s">${cUSD?`<span class="num usd-text">${usd(cUSD)}</span> · `:''}${cons.length} movimientos</span></div>
    <div class="kpi"><span class="eyebrow">Cuotas en este resumen</span><span class="v">${money(cuotaARS,false)}</span><span class="s">${cuotasMov.length} plan${cuotasMov.length===1?'':'es'} · ${cARS?Math.round(cuotaARS/cARS*100):0}% de los consumos en pesos</span></div>
    <div class="kpi"><span class="eyebrow">Impuestos y percepciones</span><span class="v">${money(impARS,false)}</span><span class="s">${credARS?`devoluciones ${money(credARS,false)} · `:''}pago mínimo ${money(minimo,false)}</span></div>
    <div class="kpi"><span class="eyebrow">Cuotas por venir</span><span class="v">${money(futTotal,false)}</span><span class="s">próximo vencimiento ${fdate(prox)}</span></div>
  </section>

  <div class="grid">
    <section class="panel"><header><h2>Gasto por categoría</h2>${legend}</header>
      <div class="bars">${catList.map(([c,v])=>barRow(c,v.ars,v.tot,v.usd,catMax)).join('')||'<span class="muted">Sin consumos.</span>'}</div>
      <p class="note">Las categorías se asignan por el nombre del comercio. Cambialas en la tabla de movimientos y se recuerdan para próximos resúmenes.</p>
    </section>
    <section class="panel"><header><h2>Cuotas a vencer</h2><span class="panel-sub">según el resumen</span></header>
      ${futList.length?`<div><div class="cols">${futList.map(f=>{const t=Object.values(f.by).reduce((x,y)=>x+y,0);return `<div class="col${f.resto?' rest':''}"><span class="tot" title="${money(t)}">${moneyShort(t)}</span><div class="stack" style="height:${(t/fMax*100).toFixed(1)}%">${brands.map(b=>f.by[b]?`<span style="flex:${f.by[b]};background:${color(b)}" title="${b}: ${money(f.by[b])}"></span>`:'').join('')}</div></div>`}).join('')}</div>
      <div class="collabs">${futList.map(f=>`<span>${f.resto?fmes(f.mes)+' en adelante':fmes(f.mes)}</span>`).join('')}</div></div>`:'<span class="muted">No hay cuotas pendientes.</span>'}
      <div class="bars">${cuotasMov.map(m=>`<div class="bar bar--cuota"><span class="lab">${esc(niceDesc(m.desc))}</span><span class="track"><span class="seg${m.brand==='Visa'?1:2}" style="width:${(m.cuota.n/m.cuota.de*100).toFixed(1)}%"></span></span><span class="val">cuota ${m.cuota.n} de ${m.cuota.de}<small class="muted">${money(m.ars,false)} por mes</small></span></div>`).join('')}</div>
    </section>
    <section class="panel"><header><h2>Dónde más gastaste</h2><span class="panel-sub">top ${merList.length} comercios</span></header>
      <div class="bars">${merList.map(m=>barRow(m.name,m.ars,m.tot,m.usd,merMax,m.n>1?` <span class="pill">×${m.n}</span>`:'')).join('')}</div>
    </section>
    <section class="panel"><header><h2>Impuestos, percepciones y devoluciones</h2></header>
      <div class="taxes">${tgList.map(([g,v])=>`<div class="taxrow"><span>${esc(g)}</span><span class="num ${v<0?'neg':''}">${money(v)}</span></div>`).join('')}
      <div class="taxrow total"><span>Neto</span><span class="num">${money(impARS+credARS)}</span></div></div>
      <p class="note">La percepción del 30% (RG 5617) se cobra sobre consumos en dólares pagados en pesos. Si pagás esos consumos con dólares propios, el banco la devuelve como crédito.</p>
    </section>
  </div>

  <section class="panel"><header><h2>Movimientos</h2><input type="search" id="q" placeholder="Buscar comercio o categoría" value="${esc(ui.q)}" aria-label="Buscar movimientos"></header>
    <div class="tablewrap"><table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Tarjeta</th><th>Categoría</th><th>Cuota</th><th class="r">Pesos</th><th class="r">Dólares</th></tr></thead>
      <tbody>${rows.map(m=>`<tr>
        <td class="num nowrap">${fdate(m.fecha)}</td>
        <td>${esc(niceDesc(m.desc))}${m.tipo!=='consumo'?` <span class="pill ${m.ars<0||m.usd<0?'ref':''}">${tipoLab[m.tipo]}</span>`:''}${m.tipo==='consumo'&&(m.ars<0||m.usd<0)?' <span class="pill ref">Devolución</span>':''}</td>
        <td><span class="dot dot--${brandClass(m.brand)}"></span> ${m.brand}</td>
        <td>${m.tipo==='consumo'?`<select data-key="${esc(m.key)}" aria-label="Categoría de ${esc(niceDesc(m.desc))}">${CAT_LIST.map(c=>`<option ${c===catOf(m)?'selected':''}>${c}</option>`).join('')}</select>`:'<span class="muted">—</span>'}</td>
        <td>${m.cuota?`<span class="pill">${m.cuota.n}/${m.cuota.de}</span>`:''}</td>
        <td class="r num ${m.ars<0?'neg':''}">${m.ars?money(m.ars):''}</td>
        <td class="r num ${m.usd<0?'neg':m.usd>0?'usd-text':''}">${m.usd?usd(m.usd):''}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel"><header><h2>Control de lectura</h2></header><div class="checks">${checks}</div></section>
  </div>`;
}

// events
document.addEventListener('click',e=>{
  const rm=e.target.closest('[data-rm]'); if(rm){ statements=statements.filter(s=>sid(s)!==rm.dataset.rm); save(); render(); return; }
  const cb=e.target.closest('[data-card]'); if(cb){ ui.card=cb.dataset.card; render(); return; }
  if(e.target.id==='clear'){ document.getElementById('clearbox').innerHTML='<span class="confirm">¿Borrar todos los resúmenes? <button class="btn small" id="clearyes" type="button">Sí, borrar</button><button class="btn small" id="clearno" type="button">Cancelar</button></span>'; return; }
  if(e.target.id==='clearyes'||e.target.id==='clearno'){ if(e.target.id==='clearyes'){ statements=[]; save(); render(); }
    document.getElementById('clearbox').innerHTML='<button class="btn small" id="clear" type="button">Borrar todo</button>'; }
});
document.addEventListener('change',e=>{
  if(e.target.id==='period'){ ui.period=e.target.value; render(); }
  if(e.target.dataset&&e.target.dataset.key){ catOverride[e.target.dataset.key]=e.target.value; store.set(':cat',catOverride); render(); }
  if(e.target.id==='file'){ handleFiles(e.target.files); e.target.value=''; }
});
document.addEventListener('input',e=>{ if(e.target.id==='q'){ ui.q=e.target.value; const pos=e.target.selectionStart; render(); const q=document.getElementById('q'); q.focus(); try{q.setSelectionRange(pos,pos)}catch(_){} } });
const drop=document.getElementById('drop');
['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault();if(t==='drop'||!e.relatedTarget)drop.classList.remove('over')}));
document.addEventListener('drop',e=>{ if(e.dataTransfer&&e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc='js/vendor/pdf.worker.min.js';
async function readPdf(file){
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise; const pages=[];
  for(let p=1;p<=doc.numPages;p++){ const tc=await (await doc.getPage(p)).getTextContent(); pages.push(tc.items.map(i=>({x:i.transform[4],y:i.transform[5],s:i.str}))); }
  return pages;
}
async function handleFiles(fileList){
  const files=Array.from(fileList);
  const st=document.getElementById('status'); st.className='status'; st.textContent='Leyendo…';
  if(!window.pdfjsLib){ st.className='status err'; st.textContent='No se pudo cargar el lector de PDF. Recargá la página.'; return; }
  const errs=[]; let n=0, last=null;
  for(const f of files){
    try{ const s=parseStatement(await readPdf(f));
      if(!s.cierre||s.saldoARS==null) throw new Error('formato');
      s.cuenta=String(s.cuenta||'').slice(-4); s.archivo=f.name;
      statements=statements.filter(x=>sid(x)!==sid(s)).concat(s); n++; last=s.cierre;
    }catch(err){ errs.push(f.name); }
  }
  save(); if(last) ui.period=periods()[0];
  st.className='status'+(errs.length?' err':'');
  st.textContent=(n?`${n} ${n>1?'resúmenes':'resumen'} cargado${n>1?'s':''}. `:'')+(errs.length?`No reconocí ${errs.join(', ')} como resumen de tarjeta BBVA.`:'');
  render();
}
render();

// ---------- App instalable (PWA) ----------
const installBox=document.getElementById('install');
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let installEvent=null;
function showInstall(text,withButton){
  if(isStandalone()||store.get(':noinstall',false)) return;
  if(text) document.getElementById('install-text').textContent=text;
  document.getElementById('install-btn').hidden=!withButton;
  installBox.hidden=false;
}
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvent=e; showInstall(null,true); });
window.addEventListener('appinstalled',()=>{ installBox.hidden=true; installEvent=null; });
document.getElementById('install-btn').addEventListener('click',async()=>{
  if(!installEvent) return;
  installEvent.prompt(); await installEvent.userChoice.catch(()=>{}); installEvent=null; installBox.hidden=true;
});
document.getElementById('install-close').addEventListener('click',()=>{ installBox.hidden=true; store.set(':noinstall',true); });
if(isIOS && !isStandalone()) showInstall('Para instalarla en el iPhone: tocá Compartir en Safari y después “Agregar a inicio”.',false);

// PDF compartidos desde otra app (Android): el service worker los deja guardados.
async function loadShared(){
  if(!('caches' in window)) return;
  const cache=await caches.open('mis-tarjetas-compartidos'); const reqs=await cache.keys(); if(!reqs.length) return;
  const files=[];
  for(const r of reqs){ const res=await cache.match(r); const blob=await res.blob();
    files.push(new File([blob],decodeURIComponent(res.headers.get('X-Nombre')||'resumen.pdf'),{type:'application/pdf'})); await cache.delete(r); }
  history.replaceState(null,'',location.pathname);
  await handleFiles(files);
}
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('sw.js').then(()=>loadShared()).catch(()=>{});
}
