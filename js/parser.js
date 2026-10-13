// © 2026 Jesus Alfredo Garcia Luquez. Todos los derechos reservados.
// Lector de resúmenes de tarjeta BBVA Argentina a partir del texto de PDF.js.
'use strict';

// BBVA Argentina credit-card statement parser. Input: pages = [[{x,y,s}]] (PDF text items, y grows upward).
const MESES = {ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,SET:9,OCT:10,NOV:11,DIC:12};
const MONEY = /^-?\$?\s?[\d.]+,\d{2}-?$/;
function num(s){ s=String(s).replace(/[$\s]/g,''); let neg=false; if(s.endsWith('-')){neg=true;s=s.slice(0,-1);} if(s.startsWith('-')){neg=true;s=s.slice(1);} const v=parseFloat(s.replace(/\./g,'').replace(',','.')); return neg?-v:v; }
function fecha(s){ const m=/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(s.trim()); if(!m) return null; const mo=MESES[m[2].toUpperCase()]; if(!mo) return null; return `20${m[3]}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
function rowsOf(items){
  const its=items.filter(i=>i.s.trim()).sort((a,b)=>b.y-a.y||a.x-b.x); const rows=[];
  for(const it of its){ const r=rows[rows.length-1]; if(r && Math.abs(r.y-it.y)<=3){ r.items.push(it);} else rows.push({y:it.y,items:[it]}); }
  for(const r of rows){ r.items.sort((a,b)=>a.x-b.x); r.text=r.items.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim(); }
  return rows;
}
// values under a row of labels: assign each value to the label with the largest x <= value.x+8
function labelValues(rows, labelMatch, labels){
  for(let i=0;i<rows.length;i++){
    if(!labelMatch.test(rows[i].text)) continue;
    const lx=[]; for(const lab of labels){ const it=rows[i].items.find(t=>t.s.toUpperCase().startsWith(lab)); lx.push(it?it.x:null); }
    const out={}; const y0=rows[i].y;
    for(let j=i+1;j<rows.length && rows[j].y>y0-22;j++) for(const it of rows[j].items){
      let best=-1; lx.forEach((x,k)=>{ if(x!=null && x<=it.x+8 && (best<0||x>lx[best])) best=k; });
      if(best>=0){ out[labels[best]]=((out[labels[best]]||'')+' '+it.s).trim(); }
    }
    return out;
  }
  return {};
}
function normMerchant(d){
  let s=d.toUpperCase().replace(/\s+/g,' ').trim();
  s=s.replace(/^(DLO|MERPAGO|PAYU\*AR|PAYU|WL|MP|DLOCAL|EBANX|PAYPAL)\s?\*\s?/,'');
  if(/^PEDIDOSYA/.test(s)) return /PROPINA/.test(s)?'PEDIDOSYA PROPINA':/MARKET/.test(s)?'PEDIDOSYA MARKET':'PEDIDOSYA';
  s=s.replace(/^GOOGLE \*/,'GOOGLE ').replace(/\.COM(\.AR)?$/,'').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  if(/^PRIME ?VIDEO/.test(s)) return 'PRIMEVIDEO';
  if(/^STEAM/.test(s)) return 'STEAM';
  if(/^MICROSOFT/.test(s)) return 'MICROSOFT';
  return s;
}
function parseStatement(pages){
  const pageRows=pages.map(rowsOf); const r1=pageRows[0]||[]; const all=pageRows.flat();
  const full=all.map(r=>r.text).join('\n');
  const st={brand:null,card:null,cuenta:null,cierre:null,vencimiento:null,saldoARS:null,saldoUSD:null,minimo:null,proxCierre:null,proxVenc:null,cierreAnt:null,tnaARS:null,cuotasFuturas:[],totalesConsumo:{ars:0,usd:0},movs:[]};
  const cardRow=r1.find(r=>/\bcuenta\s+\d+/.test(r.text));
  if(cardRow){ const m=/^(.*?)\s+cuenta\s+(\d+)/.exec(cardRow.text); st.card=m[1].trim(); st.cuenta=m[2]; }
  st.brand=/visa/i.test(st.card||full.slice(0,400))?'Visa':/master/i.test(st.card||full.slice(0,400))?'Mastercard':(st.card||'Tarjeta');
  const h=labelValues(r1,/CIERRE ACTUAL/,['CIERRE ACTUAL','VENCIMIENTO ACTUAL','SALDO ACTUAL $','SALDO ACTUAL U$S','PAGO M']);
  st.cierre=fecha(h['CIERRE ACTUAL']||''); st.vencimiento=fecha(h['VENCIMIENTO ACTUAL']||'');
  if(h['SALDO ACTUAL $']) st.saldoARS=num(h['SALDO ACTUAL $']); if(h['SALDO ACTUAL U$S']) st.saldoUSD=num(h['SALDO ACTUAL U$S']); if(h['PAGO M']) st.minimo=num(h['PAGO M']);
  const o=labelValues(r1,/CIERRE ANTERIOR/,['CIERRE ANTERIOR','VENCIMIENTO ANTERIOR','PR']);
  st.cierreAnt=fecha(o['CIERRE ANTERIOR']||'');
  const pr=(o['PR']||'').split(' ').map(fecha).filter(Boolean); st.proxCierre=pr[0]||null; st.proxVenc=pr[1]||null;
  const tna=/TNA \$[\s\S]{0,40}?(\d+,\d+)\s?%/.exec(full); if(tna) st.tnaARS=num(tna[1]);
  // cuotas a vencer
  const MR=/^(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\/(\d\d)$/;
  const MN=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  for(let i=0;i<r1.length;i++){
    const ms=r1[i].items.filter(t=>MR.test(t.s.trim())); if(ms.length<2) continue;
    const vals=[]; for(let j=i+1;j<r1.length && r1[j].y>r1[i].y-26;j++) for(const t of r1[j].items){ const s=t.s.replace(/\$/g,'').trim(); if(/^[\d.]+,\d{2}$/.test(s)) vals.push({x:t.x,v:num(s)}); }
    vals.sort((a,b)=>a.x-b.x);
    ms.forEach((m,k)=>{ const mm=MR.exec(m.s.trim()); let mi=MN.indexOf(mm[1])+1; if(!mi) mi=9; if(vals[k]) st.cuotasFuturas.push({mes:`20${mm[2]}-${String(mi).padStart(2,'0')}`,monto:vals[k].v}); });
    break;
  }
  const ap=/A partir de\s+([A-Za-zé]+)\/(\d\d)\s+\$\s*([\d.]+,\d{2})/i.exec(full.replace(/\n/g,' '));
  if(ap){ let mi=MN.indexOf(ap[1].toUpperCase())+1; if(mi) st.cuotasFuturas.push({mes:`20${ap[2]}-${String(mi).padStart(2,'0')}`,monto:num(ap[3]),resto:true}); }
  // resumen: totales de consumos declarados
  let inDet=false;
  st.saldoAnt={ars:0,usd:0};
  for(const r of r1){ if(r.text==='DETALLE') {inDet=true;break;}
    if(/^SALDO ANTERIOR/.test(r.text)){ for(const t of r.items){ if(t.x>=430 && MONEY.test(t.s.trim())){ if(t.x>=520) st.saldoAnt.usd=num(t.s); else st.saldoAnt.ars=num(t.s);} } }
    if(/^TOTAL CONSUMOS/.test(r.text)){ for(const t of r.items){ if(t.x>=430 && MONEY.test(t.s.trim())){ if(t.x>=520) st.totalesConsumo.usd+=num(t.s); else st.totalesConsumo.ars+=num(t.s);} } } }
  // detalle
  let sec=null, det=false;
  for(const r of all){
    const T=r.text;
    if(T==='DETALLE'){det=true;continue;} if(!det) continue;
    if(/^Sus pagos y ajustes/i.test(T)){sec='pago';continue;}
    if(/^Consumos\s/.test(T)){sec='consumo';continue;}
    if(/^Impuestos, cargos e intereses/i.test(T)){sec='impuesto';continue;}
    if(/^Legales y avisos/i.test(T)){sec=null;det=false;continue;}
    if(!sec) continue;
    const first=r.items[0]; const f=first && first.x<105 ? fecha(first.s) : null; if(!f) continue;
    const desc=[], m={ars:0,usd:0}; let cupon=null;
    for(const t of r.items.slice(1)){
      const s=t.s.trim();
      if(t.x>=430 && MONEY.test(s)){ if(t.x>=520) m.usd+=num(s); else m.ars+=num(s); continue; }
      if(t.x>=370 && t.x<440 && /^\d{3,}$/.test(s)){ cupon=s; continue; }
      if(t.x<440) desc.push(s);
    }
    let d=desc.join(' ').replace(/\s+/g,' ').trim(); let cuota=null;
    const c=/\bC\.(\d{1,2})\/(\d{1,2})\b/.exec(d); if(c){ cuota={n:+c[1],de:+c[2]}; d=d.replace(c[0],'').trim(); }
    let origUSD=null; const u=/(\d*)USD\s+([\d.]+,\d{2})\s*$/.exec(d); if(u){ origUSD=num(u[2]); d=d.slice(0,u.index).trim(); }
    let tipo=sec;
    if(sec==='pago') tipo=/^SU PAGO/i.test(d)?'pago':'credito';
    if(sec==='impuesto' && /^CR\./.test(d)) tipo='credito';
    st.movs.push({fecha:f,desc:d,cupon,cuota,ars:Math.round(m.ars*100)/100,usd:Math.round(m.usd*100)/100,tipo,key:tipo==='consumo'?normMerchant(d):d});
  }
  return st;
}
if(typeof module!=='undefined') module.exports={parseStatement,rowsOf,normMerchant};
