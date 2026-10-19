// Pengecekan akses (dipakai halaman login, daftar, admin, dan app) — satu sumber kebenaran agar tidak terjadi redirect berputar.
import * as F from './firebase.js';
const { db } = F;
export const norm = e => String(e || '').trim().toLowerCase();
export const valid = d => !!d && d.active === true && (!d.expiresAt || d.expiresAt.toDate() > new Date());
export const isAdmin = async u => { try { return (await F.getDoc(F.doc(db, 'admins', u.uid))).exists(); } catch { return false; } };
// Dipakai sebelum daftar. true/false = hasil cek, null = tidak bisa dicek (rules belum diperbarui / offline) -> lanjut, nanti dijaga saat masuk.
export async function emailAllowed(email) {
  try { const s = await F.getDoc(F.doc(db, 'access', norm(email))); return s.exists() && valid(s.data()); } catch { return null; }
}
// Dipakai setelah login (email sudah terverifikasi). Melempar error jika Firestore gagal dibaca.
export async function accessOf(u) {
  if (await isAdmin(u)) return { admin: true, ok: true };
  const s = await F.getDoc(F.doc(db, 'access', norm(u.email)));
  return { admin: false, ok: s.exists() && valid(s.data()) };
}
