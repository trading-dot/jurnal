// Format angka gaya Indonesia: titik = pemisah ribuan, koma = desimal (1.234.567,89).
export const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Angka (JS) -> teks untuk ditampilkan di input.
export const fmtNum = v => {
  if (v == null || v === '') return '';
  const [i, d] = String(v).split('.');
  return grp(i) + (d != null ? ',' + d : '');
};

// Teks dari input (atau angka) -> angka JS. Kosong/tidak valid -> null.
export const num = v => {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

// Dipanggil tiap user mengetik. Mengembalikan [teks_baru, posisi_kursor].
// typedSep: karakter yang baru diketik adalah "." atau "," -> dianggap koma desimal
// (titik yang sudah ada di teks adalah pemisah ribuan hasil format otomatis).
// paste: teks ditempel; "12.5" dianggap desimal, "1.234" dianggap ribuan.
export function fmtLive(raw, pos, typedSep, paste) {
  let decAt = -1;
  if (typedSep) decAt = pos - 1;
  else if (paste && !raw.includes(',')) {
    const m = raw.match(/^[^.]*\.(\d*)$/);
    if (m && (m[1].length !== 3 || /^0\./.test(raw))) decAt = raw.indexOf('.');
  }
  let out = '', dec = false, sig = 0;
  for (let k = 0; k < raw.length; k++) {
    const ch = raw[k], before = k < pos;
    if (ch >= '0' && ch <= '9') { out += ch; if (before) sig++; }
    else if ((ch === ',' || k === decAt) && !dec) { dec = true; out += ','; if (before) sig++; }
  }
  const i = out.indexOf(','), text = grp(i < 0 ? out : out.slice(0, i)) + (i < 0 ? '' : out.slice(i));
  let c = 0, seen = 0;
  if (sig > 0) { for (; c < text.length; c++) { if (text[c] !== '.') seen++; if (seen === sig) { c++; break; } } }
  return [text, c];
}
