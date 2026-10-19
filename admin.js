import * as F from './firebase.js';
import { isAdmin, norm, valid } from './access.js';
const { auth, db } = F, $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 4000); };
const box = h => $('#box').innerHTML = h;
const st = { access: [], users: new Set(), q: '', unsub: [] };
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const status = a => !a.active ? 'Nonaktif' : valid(a) ? 'Aktif' : 'Kedaluwarsa';
const acc = id => F.doc(db, 'access', id);

function render() {
  const q = st.q.toLowerCase(), list = st.access.filter(a => a.id.includes(q))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 9e15) - (a.createdAt?.toMillis?.() ?? 9e15));
  const n = st.access.filter(a => status(a) === 'Aktif').length;
  $('#list').innerHTML = `<small class="mu">${st.access.length} pelanggan · ${n} aktif</small>` + (list.map(a => `<div class="arow"><div><b>${esc(a.id)}</b><br>
    <span class="bdg ${status(a) === 'Aktif' ? 'pos' : 'neg'}">${status(a)}</span> <span class="bdg ${st.users.has(a.id) ? 'pos' : 'mu'}">${st.users.has(a.id) ? 'Sudah masuk' : 'Belum masuk'}</span>
    <small class="mu">${a.expiresAt ? 'Exp ' + a.expiresAt.toDate().toLocaleDateString('sv') : 'Tanpa batas waktu'}</small></div>
    <div class="row"><button data-act="tog" data-id="${esc(a.id)}">${a.active ? 'Nonaktifkan' : 'Aktifkan'}</button><button data-act="exp" data-id="${esc(a.id)}">Expiry</button><button class="dng" data-act="del" data-id="${esc(a.id)}">Hapus</button></div></div>`).join('')
    || '<p class="mu">Belum ada email. Tambahkan email pelanggan di atas.</p>');
}
function panel(u) {
  box(`<div class="adm"><div class="row top"><h1>Admin</h1><a class="lnk" href="index.html">Buka jurnal</a><button data-act="out">Keluar</button></div>
  <p class="mu">${esc(u.email)}</p>
  <div class="card"><b>Tambah pelanggan</b><p class="mu">Masukkan email pelanggan yang sudah beli. Boleh banyak sekaligus, pisahkan dengan koma atau baris baru. Setelah itu pelanggan bisa daftar.</p>
  <form id="add"><textarea name="e" rows="3" placeholder="pelanggan@gmail.com" required></textarea><button class="pri" style="width:100%;margin-top:8px">Tambah</button></form></div>
  <div class="card"><input id="q" placeholder="Cari email"><div id="list"></div></div></div>`);
  render();
}
async function addEmails(raw) {
  const all = [...new Set(raw.split(/[\s,;]+/).map(norm).filter(Boolean))], ok = all.filter(e => EMAIL.test(e)), bad = all.length - ok.length;
  const fresh = ok.filter(e => !st.access.some(a => a.id === e));
  await Promise.all(fresh.map(e => F.setDoc(acc(e), { email: e, active: true, role: 'user', expiresAt: null, createdAt: F.serverTimestamp() })));
  toast([`${fresh.length} email ditambahkan`, ok.length - fresh.length && `${ok.length - fresh.length} sudah ada`, bad && `${bad} tidak valid`].filter(Boolean).join(', '));
}
const A = {
  out: () => confirm('Keluar dari akun ini?') && F.signOut(auth),
  tog: d => F.updateDoc(acc(d.id), { active: !st.access.find(a => a.id === d.id).active }),
  del: d => confirm('Hapus ' + d.id + '? Pelanggan ini tidak bisa masuk lagi.') && F.deleteDoc(acc(d.id)),
  exp: d => { const v = prompt('Tanggal kedaluwarsa (YYYY-MM-DD). Kosongkan untuk tanpa batas:'); if (v === null) return; const t = v.trim(); if (t && isNaN(new Date(t))) return toast('Format tanggal salah.'); return F.updateDoc(acc(d.id), { expiresAt: t ? new Date(t + 'T23:59:59') : null }); },
};
document.addEventListener('click', async e => { const b = e.target.closest('[data-act]'); if (b && A[b.dataset.act]) try { await A[b.dataset.act](b.dataset); } catch (x) { toast(x.message); } });
document.addEventListener('input', e => { if (e.target.id === 'q') { st.q = e.target.value; render(); } });
document.addEventListener('submit', async e => { if (e.target.id !== 'add') return; e.preventDefault(); const f = e.target; try { await addEmails(f.e.value); f.reset(); } catch (x) { toast(x.message); } });

F.onAuthStateChanged(auth, async u => {
  st.unsub.forEach(f => f()); st.unsub = [];
  if (!u || !u.emailVerified) return location.replace('login.html?next=admin');
  if (!(await isAdmin(u))) return box(`<div class="login"><h1>Khusus admin</h1><p>Akun <b>${esc(u.email)}</b> bukan admin.</p><a class="lnk" href="index.html">Kembali ke jurnal</a><button id="ro" class="ghost">Keluar</button></div>`), $('#ro').onclick = A.out;
  panel(u);
  st.unsub.push(F.onSnapshot(F.collection(db, 'access'), s => { st.access = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, e => toast(e.message)));
  st.unsub.push(F.onSnapshot(F.collection(db, 'users'), s => { st.users = new Set(s.docs.map(d => d.data().email).filter(Boolean)); render(); }, e => toast(e.message)));
});
