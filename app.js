import * as F from './firebase.js';
import { parse } from './quick-bot.js';
import { accessOf } from './access.js';
const { auth, db } = F, $ = s => document.querySelector(s);
const st = { user: null, admin: false, accounts: [], trades: [], cash: [], cur: 'USD', view: 'dashboard', acc: 'all', f: { q: '', res: '', sort: 'desc', from: '', to: '' }, per: 'day', cal: new Date(), day: null, bot: [], draft: null, unsub: [], onboarded: false, welcomed: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n == null ? '–' : new Intl.NumberFormat(st.cur === 'IDR' ? 'id-ID' : 'en-US', { style: 'currency', currency: st.cur, maximumFractionDigits: st.cur === 'IDR' ? 0 : 2 }).format(n);
const num = v => v === '' || v == null ? null : +v;
const f2 = (n, d = 2) => n == null ? '–' : n.toFixed(d);
const cls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : '';
const today = () => new Date().toLocaleDateString('sv');
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; setTimeout(() => t.hidden = true, 3500); };
const col = n => F.collection(db, 'users', st.user.uid, n), ref = (n, id) => F.doc(db, 'users', st.user.uid, n, id);
const accName = id => (st.accounts.find(a => a.id === id) || {}).accountLabel || '(akun dihapus)';
const liveAcc = () => st.accounts.filter(a => a.status !== 'Archived');
const ft = () => st.trades.filter(t => (st.acc === 'all' || t.accountId === st.acc) && (!st.f.from || t.tradeDate >= st.f.from) && (!st.f.to || t.tradeDate <= st.f.to));
const accIds = () => new Set(st.acc === 'all' ? st.accounts.map(a => a.id) : [st.acc]);
const start = () => st.accounts.filter(a => accIds().has(a.id)).reduce((s, a) => s + (a.type === 'prop' ? a.accountSize : a.initialBalance) || 0, 0);
const cashAmt = c => c.type === 'deposit' ? c.amount : -c.amount;

function calc(t) {
  const c = t.filter(x => x.result && x.result !== 'open' && x.profitLoss != null), w = c.filter(x => x.profitLoss > 0), l = c.filter(x => x.profitLoss < 0);
  const gp = w.reduce((s, x) => s + x.profitLoss, 0), gl = -l.reduce((s, x) => s + x.profitLoss, 0);
  return { n: c.length, w: w.length, l: l.length, wr: c.length ? w.length / c.length * 100 : null, gp, gl, net: gp - gl, pf: gl ? gp / gl : null,
    avgW: w.length ? gp / w.length : null, avgL: l.length ? gl / l.length : null, rr: w.length && l.length ? (gp / w.length) / (gl / l.length) : null, avg: c.length ? (gp - gl) / c.length : null };
}
function group(t, key) { const g = {}; t.forEach(x => { const k = key(x); if (k) (g[k] = g[k] || []).push(x); }); return Object.entries(g).map(([k, v]) => [k, calc(v)]).sort((a, b) => b[1].net - a[1].net); }
function balanceSeries() {
  const ids = accIds(), ev = [];
  st.trades.filter(t => ids.has(t.accountId) && t.result !== 'open' && t.profitLoss != null).forEach(t => ev.push([t.tradeDate, t.profitLoss]));
  st.cash.filter(c => ids.has(c.accountId)).forEach(c => ev.push([c.transactionDate, cashAmt(c)]));
  ev.sort((a, b) => a[0] < b[0] ? -1 : 1); let b = start(); return ev.map(e => b += e[1]);
}
const line = pts => {
  if (pts.length < 2) return '<p class="mu">Butuh minimal 2 data untuk grafik.</p>';
  const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1;
  const p = pts.map((v, i) => `${i / (pts.length - 1) * 300},${70 - (v - mn) / r * 60}`).join(' ');
  return `<svg viewBox="0 0 300 80" style="width:100%"><polyline fill="none" stroke="var(--b)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${p}"/></svg>`;
};
const bars = rows => !rows.length ? '<p class="mu">Belum ada data.</p>' : `<svg viewBox="0 0 300 90" style="width:100%">${(() => { const m = Math.max(...rows.map(r => Math.abs(r[1])), 1), w = 300 / rows.length; return rows.map((r, i) => { const h = Math.abs(r[1]) / m * 38; return `<rect x="${i * w + 1}" y="${r[1] >= 0 ? 45 - h : 45}" width="${Math.max(w - 2, 1)}" height="${Math.max(h, 1)}" fill="${r[1] >= 0 ? 'var(--g)' : 'var(--r)'}"><title>${esc(r[0])}: ${money(r[1])}</title></rect>`; }).join(''); })()}</svg>`;

// ---------- Views ----------
const V = {};
const stat = (l, v, c = '') => `<div class="card"><small>${l}</small><h2 class="${c}">${v}</h2></div>`;
const tradeRow = t => `<div class="li" data-act="detail" data-id="${t.id}"><span><b>${esc(t.instrument)}</b> <small class="mu">${t.direction === 'sell' ? 'Sell' : 'Buy'} · ${t.tradeDate} · ${esc(accName(t.accountId))}</small></span><b class="${cls(t.profitLoss)}">${t.result === 'open' ? 'Open' : money(t.profitLoss)}</b></div>`;
V.dashboard = () => {
  const t = ft(), s = calc(t), ym = today().slice(0, 7), sm = calc(t.filter(x => x.tradeDate.startsWith(ym)));
  const ids = accIds(), cash = st.cash.filter(c => ids.has(c.accountId)).reduce((a, c) => a + cashAmt(c), 0), bal = start() + cash + s.net;
  if (!st.accounts.length) return '<div class="card">Belum ada akun trading. Buka <b>Akun</b> untuk menambah akun pertama.</div>';
  return `<div class="card hero"><small>Balance (modal awal + cash flow + realized P/L)</small><h2>${money(bal)}</h2><small>Realized P/L: <span class="${cls(s.net)}">${money(s.net)}</span> · Cash flow: ${money(cash)}</small></div>
  <div class="grid">${stat('Total trade', s.n)}${stat('Win / Loss', s.w + ' / ' + s.l)}${stat('Win rate', s.wr == null ? '–' : f2(s.wr, 1) + '%')}${stat('Profit factor', f2(s.pf))}
  ${stat('Total profit', money(s.gp), 'pos')}${stat('Total loss', money(-s.gl), 'neg')}${stat('Avg R:R (avg win/avg loss)', f2(s.rr))}${stat('Rata-rata/trade', money(s.avg), cls(s.avg))}</div>
  <div class="card"><small>Bulan ini</small><h2 class="${cls(sm.net)}">${money(sm.net)}</h2><small>${sm.n} trade</small></div>
  <div class="card"><small>Perkembangan balance</small>${line(balanceSeries())}</div>
  <div class="card"><b>Trade terbaru</b>${[...t].sort((a, b) => b.tradeDate < a.tradeDate ? -1 : 1).slice(0, 6).map(tradeRow).join('') || '<p class="mu">Belum ada trade. Tekan + atau gunakan bot.</p>'}</div>`;
};
const filt = () => `<div class="card"><div class="row"><input id="fq" placeholder="Cari instrumen/strategi/catatan" value="${esc(st.f.q)}"><select id="fr"><option value="">Semua hasil</option>${['win', 'loss', 'be', 'open'].map(x => `<option ${st.f.res === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
<div class="row"><input id="ff" type="date" value="${st.f.from}"><input id="fo" type="date" value="${st.f.to}"><select id="fs"><option value="desc">Terbaru</option><option value="asc" ${st.f.sort === 'asc' ? 'selected' : ''}>Terlama</option></select></div></div>`;
V.journal = () => {
  const q = st.f.q.toLowerCase(); let t = ft().filter(x => (!st.f.res || x.result === st.f.res) && (!q || [x.instrument, x.strategy, x.notes].join(' ').toLowerCase().includes(q)));
  t.sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1) * (st.f.sort === 'asc' ? 1 : -1));
  return filt() + `<div class="card">${t.map(tradeRow).join('') || '<p class="mu">Tidak ada trade yang cocok.</p>'}</div>`;
};
V.calendar = () => {
  const y = st.cal.getFullYear(), m = st.cal.getMonth(), t = ft(), first = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  let h = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<div class="h">${d}</div>`).join('') + '<div style="visibility:hidden"></div>'.repeat(first);
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dt = t.filter(x => x.tradeDate === ds), pl = dt.reduce((s, x) => s + (x.profitLoss || 0), 0);
    h += `<div class="${dt.length ? (pl >= 0 ? 'w' : 'l') : ''} ${st.day === ds ? 's' : ''}" data-act="day" data-d="${ds}"><b>${d}</b>${dt.length ? `<br>${money(pl)}<br>${dt.length} trade` : ''}</div>`;
  }
  const dl = st.day ? ft().filter(x => x.tradeDate === st.day) : [];
  return `<div class="row"><button data-act="mon" data-n="-1">‹</button><b style="text-align:center">${st.cal.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</b><button data-act="mon" data-n="1">›</button></div><br><div class="cal">${h}</div>
  ${st.day ? `<div class="card" style="margin-top:12px"><div class="row"><b>${st.day}</b><button class="pri" data-act="addTrade" data-d="${st.day}">+ Jurnal</button></div>${dl.map(tradeRow).join('') || '<p class="mu">Belum ada trade.</p>'}</div>` : ''}`;
};
V.stats = () => {
  const t = ft(), s = calc(t), tb = (title, rows) => `<div class="card"><b>${title}</b><table><tr><th></th><th>Trade</th><th>WR</th><th>Net</th></tr>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1].n}</td><td>${r[1].wr == null ? '–' : f2(r[1].wr, 0) + '%'}</td><td class="${cls(r[1].net)}">${money(r[1].net)}</td></tr>`).join('') || '<tr><td>Belum ada data</td></tr>'}</table></div>`;
  const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], c = t.filter(x => x.result !== 'open' && x.profitLoss != null).sort((a, b) => a.tradeDate < b.tradeDate ? -1 : 1);
  let peak = 0, cum = 0, dd = 0; c.forEach(x => { cum += x.profitLoss; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); });
  const key = x => st.per === 'month' ? x.tradeDate.slice(0, 7) : st.per === 'week' ? (d => (d.setDate(d.getDate() - (d.getDay() + 6) % 7), d.toLocaleDateString('sv')))(new Date(x.tradeDate + 'T00:00')) : x.tradeDate;
  const per = group(c, key).sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => [r[0], r[1].net]);
  return filt() + `<div class="grid">${stat('Win rate', s.wr == null ? '–' : f2(s.wr, 1) + '%')}${stat('Profit factor', f2(s.pf))}${stat('Avg win', money(s.avgW), 'pos')}${stat('Avg loss', money(s.avgL ? -s.avgL : null), 'neg')}${stat('Net P/L', money(s.net), cls(s.net))}${stat('R:R rata-rata', f2(s.rr))}${stat('Max drawdown (P/L)', c.length ? money(-dd) : '–', 'neg')}${stat('Total trade', s.n)}</div>
  <p class="mu">Drawdown dihitung dari kurva kumulatif P/L trade. Metrik "–" = data belum cukup (mis. R:R butuh minimal 1 win dan 1 loss).</p>
  <div class="card"><div class="row"><b>Hasil per periode</b><select id="per">${['day', 'week', 'month'].map(p => `<option value="${p}" ${st.per === p ? 'selected' : ''}>${{ day: 'Harian', week: 'Mingguan', month: 'Bulanan' }[p]}</option>`).join('')}</select></div>${bars(per)}</div>
  ${tb('Per instrumen', group(c, x => x.instrument))}${tb('Per strategi', group(c, x => x.strategy))}${tb('Per hari', group(c, x => hari[new Date(x.tradeDate + 'T00:00').getDay()]))}${tb('Per jam entry', group(c, x => x.time ? x.time.slice(0, 2) + ':00' : null))}`;
};
V.accounts = () => `<button class="pri" data-act="addAcc">+ Tambah akun</button><br><br>${st.accounts.map(a => {
  const ids = [a.id], net = calc(st.trades.filter(t => t.accountId === a.id)).net, cs = st.cash.filter(c => c.accountId === a.id), cf = cs.reduce((s, c) => s + cashAmt(c), 0), base = (a.type === 'prop' ? a.accountSize : a.initialBalance) || 0;
  return `<div class="card"><b>${esc(a.accountLabel)}</b> <small class="mu">${a.type === 'prop' ? 'Prop Firm' : 'Broker'} · ${esc(a.providerName)} · ${a.status}</small>
  <p>Modal awal: ${money(base)}<br>Realized P/L: <span class="${cls(net)}">${money(net)}</span><br>Cash flow: ${money(cf)}<br><b>Balance: ${money(base + net + cf)}</b></p>
  <div class="row"><button data-act="cash" data-id="${a.id}">Deposit/WD</button><button data-act="editAcc" data-id="${a.id}">Edit</button><button data-act="arch" data-id="${a.id}">${a.status === 'Archived' ? 'Aktifkan' : 'Arsip'}</button><button class="dng" data-act="delAcc" data-id="${a.id}">Hapus</button></div>
  ${cs.length ? `<small class="mu">${cs.sort((x, y) => x.transactionDate < y.transactionDate ? 1 : -1).slice(0, 3).map(c => `${c.transactionDate} ${c.type} ${money(c.amount)}`).join(' | ')}</small>` : ''}</div>`;
}).join('') || '<p class="mu">Belum ada akun.</p>'}`;
V.settings = () => `<div class="card"><label>Mata uang tampilan<select id="cur"><option>USD</option><option ${st.cur === 'IDR' ? 'selected' : ''}>IDR</option></select></label><small class="mu">Hanya format tampilan; nominal tidak dikonversi.</small></div><div class="card">${esc(st.user.email)}<br><br>${st.admin ? '<a class="lnk" href="admin.html">Buka halaman admin</a><br><br>' : ''}<button class="dng" data-act="out">Keluar</button></div>`;
// ---------- Render ----------
const P = { dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', journal: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', stats: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>', accounts: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-1z"/><circle cx="16.5" cy="14" r="1.2"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>', out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>' };
const ico = k => `<svg class="i" viewBox="0 0 24 24">${P[k]}</svg>`;
const NAV = [['dashboard', 'Dashboard'], ['journal', 'Journal'], ['calendar', 'Calendar'], ['stats', 'Stats'], ['accounts', 'Akun'], ['settings', 'Setelan']];
const wideKey = 'side-wide', isDesk = () => matchMedia('(min-width:900px)').matches;
const getWide = () => { try { return localStorage.getItem(wideKey) === '1'; } catch { return false; } };
function render() {
  if (!st.user || $('#app').hidden) return;
  const em = st.user.email || '', side = $('#side');
  side.className = (side.classList.contains('show') ? 'show ' : '') + (getWide() ? 'wide' : '');
  side.innerHTML = `<div class="brand"><span class="mk">${ico('stats')}</span><span>Trading Journal</span></div><nav class="nv">${NAV.map(n => `<button class="nb ${st.view === n[0] ? 'on' : ''}" data-act="nav" data-v="${n[0]}" title="${n[1]}">${ico(n[0])}<span class="lb">${n[1]}</span></button>`).join('')}</nav>
  <div class="bt"><div class="me" title="${esc(em)}"><span class="av">${esc(em[0] || '?').toUpperCase()}</span><div class="lb"><b>${esc(em.split('@')[0])}</b><small>${esc(em)}</small></div></div><button class="nb lo" data-act="out" title="Keluar">${ico('out')}<span class="lb">Keluar</span></button></div>`;
  $('#ttl').textContent = NAV.find(n => n[0] === st.view)[1];
  $('#accSel').innerHTML = `<option value="all">Semua akun</option>` + liveAcc().map(a => `<option value="${a.id}" ${st.acc === a.id ? 'selected' : ''}>${esc(a.accountLabel)}</option>`).join('');
  const sy = scrollY; $('#main').innerHTML = V[st.view](); scrollTo(0, sy);
  $('#bm').innerHTML = st.bot.map(m => `<div class="m ${m.u ? 'u' : ''}">${m.h}</div>`).join(''); $('#bm').scrollTop = 1e9;
}

// ---------- Forms ----------
function form(title, fields, vals, onSave) {
  const m = $('#modal'), fld = ([n, l, t, o, k]) => { const v = vals[n] ?? ''; return `<label data-k="${k || ''}">${l}${t === 'select' ? `<select name="${n}">${o.map(x => { const [a, b] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(a)}" ${a == v ? 'selected' : ''}>${esc(b)}</option>`; }).join('')}</select>` : t === 'area' ? `<textarea name="${n}" rows="3">${esc(v)}</textarea>` : `<input name="${n}" type="${t}" value="${esc(v)}" step="any">`}</label>`; };
  m.innerHTML = `<div class="sheet"><h3>${title}</h3><form id="f">${fields.map(fld).join('')}<div class="row"><button type="button" class="ghost" data-act="close">Batal</button><button class="pri">Simpan</button></div></form></div>`; m.hidden = false;
  const tk = () => { const t = $('#f [name=type]'); if (t) document.querySelectorAll('#f [data-k]').forEach(l => l.hidden = l.dataset.k && l.dataset.k !== t.value); };
  tk(); $('#f').onchange = tk;
  $('#f').onsubmit = async e => { e.preventDefault(); try { await onSave(Object.fromEntries(new FormData(e.target))); m.hidden = true; } catch (x) { toast(x.message); } };
}
const tradeForm = (v = {}, id) => form(id ? 'Edit trade' : 'Tambah trade', [['tradeDate', 'Tanggal', 'date'], ['time', 'Jam entry (opsional)', 'time'], ['accountId', 'Akun', 'select', [['', '— pilih akun —'], ...liveAcc().map(a => [a.id, a.accountLabel])]], ['instrument', 'Instrumen (XAUUSD, EURUSD…)', 'text'], ['direction', 'Posisi', 'select', [['buy', 'Buy/Long'], ['sell', 'Sell/Short']]], ['timeframe', 'Timeframe', 'text'], ['strategy', 'Setup/strategi', 'text'], ['entryPrice', 'Entry', 'number'], ['stopLoss', 'Stop loss', 'number'], ['takeProfit', 'Take profit', 'number'], ['exitPrice', 'Exit', 'number'], ['positionSize', 'Lot/size', 'number'], ['riskAmount', 'Risk nominal', 'number'], ['result', 'Hasil', 'select', [['win', 'Win'], ['loss', 'Loss'], ['be', 'Breakeven'], ['open', 'Open']]], ['profitLoss', 'Profit/loss nominal (isi angka positif, tanda mengikuti hasil)', 'number'], ['emotion', 'Emosi saat entry', 'text'], ['notes', 'Alasan entry, catatan & evaluasi', 'area']], { tradeDate: today(), ...v }, async d => {
  if (!d.accountId || !d.instrument.trim() || !d.tradeDate) throw new Error('Tanggal, akun, dan instrumen wajib diisi.');
  const o = { ...d, instrument: d.instrument.trim().toUpperCase() }; ['entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'positionSize', 'riskAmount', 'profitLoss'].forEach(k => o[k] = num(d[k]));
  const a = Math.abs(o.profitLoss); if (d.result !== 'open' && d.result !== 'be' && o.profitLoss == null) throw new Error('Isi nominal profit/loss untuk hasil Win/Loss.');
  o.profitLoss = d.result === 'win' ? a : d.result === 'loss' ? -a : d.result === 'be' ? 0 : null;
  o.rr = o.entryPrice != null && o.stopLoss != null && o.exitPrice != null && o.entryPrice !== o.stopLoss ? +((d.direction === 'sell' ? o.entryPrice - o.exitPrice : o.exitPrice - o.entryPrice) / Math.abs(o.entryPrice - o.stopLoss)).toFixed(2) : null;
  if (id) await F.updateDoc(ref('trades', id), { ...o, updatedAt: F.serverTimestamp() }); else await F.addDoc(col('trades'), { ...o, source: st.fromBot ? 'quickbot' : 'manual', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
  st.fromBot = false; toast('Trade disimpan');
});
const accForm = (v = {}, id) => form(id ? 'Edit akun' : 'Tambah akun', [['type', 'Jenis akun', 'select', [['prop', 'Prop Firm'], ['broker', 'Broker']]], ['providerName', 'Nama prop firm / broker', 'text'], ['accountLabel', 'Label akun', 'text'], ['accountSize', 'Nominal funded account', 'number', null, 'prop'], ['initialBalance', 'Balance/modal awal', 'number', null, 'broker'], ['currency', 'Mata uang', 'text'], ['status', 'Status', 'select', ['Evaluation', 'Funded', 'Passed', 'Failed', 'Active', 'Archived']], ['startDate', 'Tanggal mulai', 'date'], ['notes', 'Catatan', 'area']], { type: 'prop', currency: 'USD', startDate: today(), ...v }, async d => {
  if (!d.providerName.trim() || !d.accountLabel.trim()) throw new Error('Nama dan label akun wajib diisi.');
  const o = { ...d, accountSize: d.type === 'prop' ? num(d.accountSize) : null, initialBalance: d.type === 'broker' ? num(d.initialBalance) : null };
  if (id) await F.updateDoc(ref('accounts', id), o); else await F.addDoc(col('accounts'), { ...o, createdAt: F.serverTimestamp() });
});
const cashForm = (v = {}) => form('Deposit / withdrawal / payout', [['type', 'Jenis', 'select', [['deposit', 'Deposit'], ['withdrawal', 'Withdrawal'], ['payout', 'Payout (prop firm)']]], ['amount', 'Nominal', 'number'], ['transactionDate', 'Tanggal', 'date'], ['notes', 'Catatan', 'area']], { transactionDate: today(), ...v }, async d => {
  const a = num(d.amount); if (!a || a <= 0 || !v.accountId) throw new Error('Nominal harus lebih dari 0.');
  await F.addDoc(col('cashTransactions'), { accountId: v.accountId, type: d.type, amount: a, currency: (st.accounts.find(x => x.id === v.accountId) || {}).currency || st.cur, transactionDate: d.transactionDate, notes: d.notes, source: st.fromBot ? 'quickbot' : 'manual', createdAt: F.serverTimestamp() }); st.fromBot = false; toast('Transaksi disimpan');
});

// ---------- Bot ----------
const say = (h, u) => { st.bot.push({ h, u }); render(); };
function preview() {
  const d = st.draft, f = d.fields, miss = d.missing, k = d.kind;
  const lines = k === 'trade' ? `Akun: ${f.accountId ? esc(accName(f.accountId)) : '<i>belum dipilih</i>'}<br>Tanggal: ${f.tradeDate}<br>Instrumen: ${esc(f.instrument || '–')}<br>Posisi: ${f.direction === 'sell' ? 'Sell' : 'Buy'}${d.dirKnown ? '' : ' (default, cek ya)'}<br>Hasil: ${f.result || '–'} ${f.profitLoss != null ? money(f.profitLoss) : ''}`
    : `Akun: ${f.accountId ? esc(accName(f.accountId)) : '<i>belum dipilih</i>'}<br>Jenis: ${f.type}<br>Nominal: ${f.amount != null ? money(f.amount) : '–'}<br>Tanggal: ${f.transactionDate}`;
  const chips = !f.accountId ? `<div class="row">${liveAcc().map(a => `<button data-act="botAcc" data-id="${a.id}">${esc(a.accountLabel)}</button>`).join('') || 'Belum ada akun — buat di menu Akun.'}</div>` : '';
  say(`Periksa data berikut:<br>${lines}${miss.length ? `<br><small class="neg">Belum lengkap: ${miss.join(', ')}. Tekan Ubah untuk melengkapi.</small>` : ''}${chips}<div class="row"><button data-act="botEdit">Ubah</button>${miss.length ? '' : '<button class="pri" data-act="botSave">Simpan</button>'}<button data-act="botCancel">Batal</button></div>`);
}
function botSend() {
  const i = $('#bi'), t = i.value.trim(); if (!t) return; i.value = ''; say(esc(t), true);
  const r = parse(t, liveAcc());
  if (!r.kind) return say('Belum paham. Contoh: <i>XAUUSD buy profit 50 dolar di akun FTMO</i>, <i>EURUSD sell loss 20 USD</i>, <i>Deposit 200 USD</i>. Atau isi lewat tombol +.');
  st.draft = r; st.fromBot = false; preview();
}
const botEdit = () => { const d = st.draft; st.fromBot = true; $('#bot').hidden = true; d.kind === 'trade' ? tradeForm(d.fields) : cashForm({ ...d.fields }); };
async function botSave() {
  const d = st.draft; if (!d || d.missing.length) return; const f = d.fields;
  try {
    if (d.kind === 'trade') await F.addDoc(col('trades'), { ...f, time: '', timeframe: '', strategy: '', entryPrice: null, stopLoss: null, takeProfit: null, exitPrice: null, positionSize: null, riskAmount: null, rr: null, notes: '', source: 'quickbot', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
    else await F.addDoc(col('cashTransactions'), { accountId: f.accountId, type: f.type, amount: f.amount, currency: (st.accounts.find(a => a.id === f.accountId) || {}).currency || st.cur, transactionDate: f.transactionDate, notes: '', source: 'quickbot', createdAt: F.serverTimestamp() });
    st.draft = null; say('Tersimpan ✓');
  } catch (e) { say('Gagal menyimpan: ' + esc(e.message)); }
}

// ---------- Actions ----------
const A = {
  nav: d => { if (d.v !== st.view) history.pushState({ v: d.v }, ''); st.view = d.v; $('#side').classList.remove('show'); $('#scrim').classList.remove('show'); render(); scrollTo(0, 0); },
  menu: () => { if (isDesk()) { try { localStorage.setItem(wideKey, getWide() ? '0' : '1'); } catch { } render(); } else { $('#side').classList.toggle('show'); $('#scrim').classList.toggle('show'); } }, close: () => $('#modal').hidden = true,
  out: () => { $('#side').classList.remove('show'); $('#scrim').classList.remove('show'); $('#modal').innerHTML = `<div class="sheet"><h3>Keluar dari akun?</h3><p class="mu">Kamu perlu masuk lagi untuk membuka jurnal.</p><div class="row"><button data-act="close">Batal</button><button class="pri" data-act="outYes">Ya, keluar</button></div></div>`; $('#modal').hidden = false; },
  outYes: () => F.signOut(auth), bot: () => { const b = $('#bot'); b.hidden = !b.hidden; if (!b.hidden) { if (!st.bot.length) st.bot.push({ h: 'Halo! Ketik catatannya, bagian lainnya saya rapikan. Saya hanya mencatat, tidak memberi sinyal trading.' }); render(); $('#bi').focus(); } },
  botSend, botEdit, botSave, botCancel: () => { st.draft = null; say('Dibatalkan.'); },
  botAcc: d => { st.draft.fields.accountId = d.id; st.draft.missing = st.draft.missing.filter(x => x !== 'akun'); preview(); },
  addTrade: d => { $('#bot').hidden = true; tradeForm(d.d ? { tradeDate: d.d } : {}); },
  detail: d => { const t = st.trades.find(x => x.id === d.id), r = (l, v) => v || v === 0 ? `<p><small class="mu">${l}</small><br>${esc(v)}</p>` : ''; $('#modal').innerHTML = `<div class="sheet"><h3>${esc(t.instrument)} ${t.direction}</h3>${r('Akun', accName(t.accountId))}${r('Tanggal', t.tradeDate + ' ' + (t.time || ''))}${r('Hasil', t.result + ' ' + (t.profitLoss != null ? money(t.profitLoss) : ''))}${r('Entry/SL/TP/Exit', [t.entryPrice, t.stopLoss, t.takeProfit, t.exitPrice].map(x => x ?? '–').join(' / '))}${r('R:R aktual', t.rr)}${r('Strategi', t.strategy)}${r('Catatan', t.notes)}<div class="row"><button data-act="close">Tutup</button><button data-act="editT" data-id="${t.id}">Edit</button><button class="dng" data-act="delT" data-id="${t.id}">Hapus</button></div></div>`; $('#modal').hidden = false; },
  editT: d => tradeForm(st.trades.find(x => x.id === d.id), d.id),
  delT: async d => { if (confirm('Hapus trade ini?')) { await F.deleteDoc(ref('trades', d.id)); A.close(); } },
  day: d => { st.day = d.d; render(); }, mon: d => { st.cal = new Date(st.cal.getFullYear(), st.cal.getMonth() + +d.n, 1); render(); },
  addAcc: () => accForm(), editAcc: d => accForm(st.accounts.find(a => a.id === d.id), d.id), cash: d => cashForm({ accountId: d.id }),
  arch: d => { const a = st.accounts.find(x => x.id === d.id); return F.updateDoc(ref('accounts', d.id), { status: a.status === 'Archived' ? 'Active' : 'Archived' }); },
  delAcc: async d => { if (confirm('Hapus akun? Trade & transaksi akun ini tidak ikut terhapus. Pertimbangkan Arsip.')) await F.deleteDoc(ref('accounts', d.id)); },
  startAcc: () => accForm(),
};
document.addEventListener('click', async e => { const b = e.target.closest('[data-act]'); if (b && A[b.dataset.act]) { try { await A[b.dataset.act](b.dataset); } catch (x) { toast(x.message); } } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#side').classList.remove('show'); $('#scrim').classList.remove('show'); $('#bot').hidden = true; $('#modal').hidden = true; } if (e.key === 'Enter' && e.target.id === 'bi') botSend(); });
document.addEventListener('change', e => {
  const i = e.target.id, v = e.target.value, m = { fq: 'q', fr: 'res', ff: 'from', fo: 'to', fs: 'sort' };
  if (i === 'accSel') st.acc = v; else if (m[i]) st.f[m[i]] = v; else if (i === 'per') st.per = v;
  else if (i === 'cur') { st.cur = v; F.setDoc(F.doc(db, 'users', st.user.uid), { currency: v }, { merge: true }); } else return; render();
});
// ---------- Tombol back HP: tutup popup dulu, lalu pindah halaman sebelumnya, tidak keluar dari web ----------
history.replaceState({ g: 1 }, ''); history.pushState({ v: st.view }, '');
addEventListener('popstate', e => {
  const side = $('#side'), open = !$('#modal').hidden || !$('#bot').hidden || side.classList.contains('show');
  if (open) { $('#modal').hidden = true; $('#bot').hidden = true; side.classList.remove('show'); $('#scrim').classList.remove('show'); history.pushState({ v: st.view }, ''); return; }
  const s = e.state || {};
  if (s.v) { st.view = s.v; render(); scrollTo(0, 0); } else { st.view = 'dashboard'; history.pushState({ v: 'dashboard' }, ''); render(); }
});
// ---------- Auth & gate ----------
// Login/daftar ada di login.html dan daftar.html. Di sini hanya penjaga: status apa pun selain "boleh masuk" dikirim ke login.html.
const gate = h => { $('#app').hidden = true; $('#gate').hidden = false; $('#gate').innerHTML = h; };
const stopSubs = () => { st.unsub.forEach(u => u()); st.unsub = []; };
const markOnboarded = () => { st.onboarded = true; F.setDoc(F.doc(db, 'users', st.user.uid), { onboarded: true }, { merge: true }).catch(() => { }); };
function welcome() {
  markOnboarded();   // ditandai saat ditampilkan, jadi hanya muncul sekali
  $('#modal').innerHTML = `<div class="sheet"><h3>Selamat datang 👋</h3><p>Mau langsung buat akun trading pertama? Di sini balance, deposit, dan jurnal dicatat per akun (prop firm atau broker).</p><p class="mu">Boleh dilewati. Akun bisa dibuat nanti di menu Akun.</p><div class="row"><button data-act="close">Nanti saja</button><button class="pri" data-act="startAcc">Buat akun trading</button></div></div>`;
  $('#modal').hidden = false;
}
F.onAuthStateChanged(auth, async u => {
  stopSubs(); st.user = u; st.welcomed = false;
  if (!u || !u.emailVerified) return location.replace('login.html');
  try {
    const r = await accessOf(u); st.admin = r.admin;
    if (!r.ok) return location.replace('login.html');
    await F.setDoc(F.doc(db, 'users', u.uid), { email: u.email.toLowerCase(), createdAt: u.metadata.creationTime, lastLogin: new Date().toISOString() }, { merge: true }).catch(() => { });
    const me = (await F.getDoc(F.doc(db, 'users', u.uid))).data() || {}; st.cur = me.currency || 'USD'; st.onboarded = !!me.onboarded;
  } catch (e) { gate(`<div class="login"><h1>Gagal memuat</h1><p class="neg">${esc(e.message)}</p><p class="mu">Pastikan Firestore Rules sudah dipublikasikan.</p><button id="ro">Keluar</button></div>`); return $('#ro').onclick = A.outYes; }
  $('#gate').hidden = true; $('#app').hidden = false;
  const sub = (c, k) => st.unsub.push(F.onSnapshot(col(c), s => {
    st[k] = s.docs.map(d => ({ id: d.id, ...d.data() }));
    if (c === 'accounts' && !st.welcomed && !s.metadata.fromCache) { st.welcomed = true; if (!s.docs.length && !st.onboarded) welcome(); }
    render();
  }, e => toast(e.message)));
  sub('accounts', 'accounts'); sub('trades', 'trades'); sub('cashTransactions', 'cash');
  render();
});
