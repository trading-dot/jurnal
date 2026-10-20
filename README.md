# Trading Journal (GitHub Pages + Firebase)

## 1. Firebase Console (project `pertemuan-5-f5c9c`)
1. **Authentication → Sign-in method**: aktifkan **Google** dan **Email/Password**.
2. **Authentication → Settings → Authorized domains**: tambahkan `USERNAME.github.io`.
3. **Firestore Database → Create database** (mode production).
4. **Firestore → Rules**: tempel isi `firestore.rules`, lalu **Publish**.

## 2. Alur halaman
- `login.html` masuk (email+password atau Google), link "Belum punya akun? Daftar".
- `daftar.html` daftar: email, password, ulangi password, atau Daftar dengan Google. Setelah verifikasi email, masuk ke jurnal.
- `index.html` jurnal. Pertama kali masuk (belum punya akun trading) muncul ajakan membuat akun trading; boleh dilewati, hanya muncul sekali.
- `admin.html` khusus admin: tambah email pelanggan yang sudah beli (boleh banyak sekaligus), aktif/nonaktif, expiry, hapus.

Hanya email yang sudah dimasukkan admin yang bisa daftar. Daftar dengan Google: akun baru yang emailnya belum dimasukkan admin otomatis dihapus lagi.

## 3. Admin pertama (aman)
1. Firestore → collection `access` → Document ID = email admin (huruf kecil) → field `email` (string), `active` (boolean) `true`. Ini perlu karena admin juga harus lolos cek saat daftar.
2. Buka `daftar.html`, daftar dengan email itu, verifikasi email, lalu masuk.
3. Firebase Console → Authentication → Users → salin **UID** akun admin.
4. Firestore → Start collection `admins` → Document ID = **UID** itu → isi 1 field bebas (mis. `role: "admin"`). Tidak bisa ditulis dari klien (`allow write: if false`).
5. Buka `admin.html`. Setelah itu email pelanggan cukup dimasukkan lewat halaman admin.

## 4. Deploy GitHub Pages
Upload semua file (tanpa folder) ke repo, langsung di root → Settings → Pages → Deploy from branch `main` / root.

## Format angka & prop firm
- Semua kolom angka otomatis diberi titik ribuan saat diketik (`1.234.567`). Desimal pakai koma (`0,01`); mengetik titik atau koma di kolom angka dianggap desimal.
- Tampilan uang: `$1.234,50` atau `Rp 1.500.000`.
- Akun Prop Firm punya kolom **Target profit (%)**, **Max drawdown (%)** dan **Tipe drawdown** (Statis dari modal awal / Trailing dari balance tertinggi). Persen dihitung dari nominal funded account. Progress tampil di Dashboard dan menu Akun. Dihitung dari trade yang sudah ditutup (realized), bukan equity floating; urutan trade di hari yang sama mengikuti jam entry.
- Persen kenaikan/penurunan = realized P/L / modal awal (tidak menghitung deposit/withdrawal).

## Status fitur
Berfungsi (kode lengkap, **hanya cek sintaks yang saya jalankan; belum diuji langsung ke Firebase**): login Google/email, reset password, verifikasi email, whitelist+expiry, halaman admin terpisah (admin.html), akun (prop/broker), deposit/withdrawal/payout, jurnal CRUD+filter, kalender, statistik, bot Catat Cepat (rule-based, preview sebelum simpan).
Belum ada: upload screenshot chart (butuh Firebase Storage), impor CSV, webhook TradingView/MT4/MT5 (butuh Cloud Functions, plan Blaze), bot AI (butuh backend, jangan taruh API key di frontend), konfigurasi pip/contract per instrumen (P/L diisi manual agar tidak salah asumsi).
Field `source` pada trade ("manual"/"quickbot") disiapkan untuk menambah `externalId` dan dedup saat impor/integrasi.
