// Bagian bersama halaman login & daftar: routing status akun, layar verifikasi, layar akses belum aktif, login Google.
import * as F from './firebase.js';
import { accessOf, emailAllowed } from './access.js';
const { auth } = F;
export const LOADER = '<div class="ld"><svg viewBox="0 0 48 48" aria-hidden="true"><path class="ax" d="M6 6v36h36"/><path class="ln" d="M11 33l9-10 7 5 11-15"/><circle class="dt" cx="38" cy="13" r="3"/></svg><p>Memuat</p></div>';
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ERR = { 'auth/invalid-email': 'Format email salah. Contoh: nama@gmail.com.', 'auth/missing-email': 'Isi email dulu.', 'auth/missing-password': 'Isi password.',
  'auth/invalid-credential': 'Email atau password salah.', 'auth/email-already-in-use': 'Email ini sudah punya akun. Silakan masuk.', 'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 'auth/network-request-failed': 'Koneksi bermasalah. Cek internet lalu coba lagi.',
  'auth/popup-blocked': 'Popup Google diblokir browser. Izinkan popup lalu coba lagi.', 'auth/user-disabled': 'Akun ini dinonaktifkan.' };
const QUIET = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
export const errMsg = e => QUIET.includes(e.code) ? '' : ERR[e.code] || e.message;
export const box = h => $('#box').innerHTML = h;
export const setErr = m => { const e = $('#err'); if (e) e.textContent = m || ''; };
export const setMsg = m => { const e = $('#msg'); if (e) e.textContent = m || ''; };
export const NOT_CUSTOMER = 'Email ini belum terdaftar sebagai pelanggan. Pakai email yang sama saat pembelian, atau hubungi admin.';

let busy = false;
export const isBusy = () => busy;
export async function guard(fn) {   // jalankan aksi sambil menahan listener auth dan mengunci tombol
  busy = true; const bs = document.querySelectorAll('.login button'); bs.forEach(b => b.disabled = true);
  try { return await fn(); } catch (e) { setErr(errMsg(e)); } finally { busy = false; bs.forEach(b => b.disabled = false); }
}
const nextUrl = admin => new URLSearchParams(location.search).get('next') === 'admin' && admin ? 'admin.html' : 'index.html';

// Tentukan tampilan sesuai status akun. showForm = tampilan form milik halaman (login/daftar).
export async function route(u, showForm) {
  if (!u) return showForm();
  if (!u.emailVerified) return verifyView(u, showForm);
  box(LOADER);
  try {
    const r = await accessOf(u);
    if (r.ok) return location.replace(nextUrl(r.admin));
    deniedView(u, showForm);
  } catch (e) {
    box(`<div class="login"><h1>Gagal memuat</h1><p class="neg">${esc(e.message)}</p><p class="mu">Pastikan Firestore Rules terbaru sudah dipublikasikan.</p><button id="ro">Keluar</button></div>`);
    $('#ro').onclick = () => F.signOut(auth);
  }
}
function verifyView(u, showForm) {
  box(`<div class="login"><h1>Cek email kamu</h1><p>Kami mengirim link verifikasi ke <b>${esc(u.email)}</b>. Klik link itu, lalu tekan tombol di bawah.</p><p class="neg" id="err"></p><p class="pos" id="msg"></p>
  <button class="pri" id="vk">Saya sudah verifikasi</button><button id="vr">Kirim ulang email</button><button class="ghost" id="ro">Keluar</button></div>`);
  $('#vk').onclick = () => guard(async () => {
    await u.reload(); await u.getIdToken(true);   // refresh token supaya status verifikasi terbaca oleh Firestore Rules
    if (!auth.currentUser.emailVerified) return setErr('Email belum terverifikasi. Cek inbox atau folder spam.');
    await route(auth.currentUser, showForm);
  });
  $('#vr').onclick = () => guard(async () => { await F.sendEmailVerification(u); setMsg('Email verifikasi dikirim ulang.'); });
  $('#ro').onclick = () => F.signOut(auth);
}
function deniedView(u, showForm) {
  box(`<div class="login"><h1>Akses belum aktif</h1><p>Email <b>${esc(u.email)}</b> belum terdaftar sebagai pelanggan, atau masa aktifnya habis. Hubungi admin, lalu tekan Cek lagi.</p><p class="neg" id="err"></p>
  <button class="pri" id="rc">Cek lagi</button><button class="ghost" id="ro">Keluar</button></div>`);
  $('#rc').onclick = () => route(u, showForm);
  $('#ro').onclick = () => F.signOut(auth);
}
// Login/daftar Google. Akun Google BARU yang emailnya belum dimasukkan admin langsung dihapus lagi.
export const google = showForm => guard(async () => {
  const r = await F.signInWithPopup(auth, new F.GoogleAuthProvider());
  if (F.getAdditionalUserInfo(r)?.isNewUser && await emailAllowed(r.user.email) === false) {
    await F.deleteUser(r.user).catch(() => F.signOut(auth));
    throw { message: NOT_CUSTOMER };
  }
  await route(auth.currentUser, showForm);
});
