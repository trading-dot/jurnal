// Parser berbasis aturan (tanpa AI eksternal). Tidak menyimpan apa pun; hanya mengembalikan draf.
const INS = { gold: 'XAUUSD', emas: 'XAUUSD', xau: 'XAUUSD', btc: 'BTCUSD', eth: 'ETHUSD', nasdaq: 'NAS100' };
const iso = d => d.toLocaleDateString('sv');
const pad = n => String(n).padStart(2, '0');
export function parse(text, accounts = []) {
  let s = ' ' + text.toLowerCase() + ' ', f = {}, m;
  // akun: hanya jika tepat satu akun cocok
  const hit = k => accounts.filter(a => { const v = (a[k] || '').toLowerCase(); return v && s.includes(v); });
  let c = hit('accountLabel'); if (!c.length) c = hit('providerName');
  if (c.length === 1) {
    f.accountId = c[0].id;
    [c[0].accountLabel, c[0].providerName].forEach(v => { if (v) s = s.replace(v.toLowerCase(), ' '); });
  }
  // tanggal
  const d = new Date();
  if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) { f.date = m[0]; s = s.replace(m[0], ' '); }
  else if ((m = s.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/))) {
    const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : d.getFullYear();
    f.date = `${y}-${pad(m[2])}-${pad(m[1])}`; s = s.replace(m[0], ' ');
  } else { if (/kemarin|yesterday/.test(s)) d.setDate(d.getDate() - 1); f.date = iso(d); }
  // instrumen
  m = s.match(/\b(xauusd|eurusd|gbpusd|usdjpy|audusd|usdcad|nas100|us30|spx500|btcusd|ethusd|gold|emas|xau|btc|eth|nasdaq|[a-z]{3}usd|usd[a-z]{3})\b/);
  if (m) { f.instrument = INS[m[1]] || m[1].toUpperCase(); s = s.replace(m[0], ' '); }
  s = s.replace(/[\d.,]+\s*lot/g, ' ');
  const cash = s.match(/\b(deposit|setor|topup|top up|withdraw|withdrawal|tarik|wd|payout)\b/);
  const dir = /\b(buy|long|beli)\b/.test(s) ? 'buy' : /\b(sell|short|jual)\b/.test(s) ? 'sell' : null;
  const res = /\b(breakeven|break even|be|bep)\b/.test(s) ? 'be'
    : /\b(profit|untung|cuan|win|menang|tp)\b/.test(s) ? 'win'
    : /\b(loss|rugi|minus|lose|kalah|sl)\b/.test(s) ? 'loss' : null;
  // nominal
  let amount = null;
  if ((m = s.match(/(\d+(?:[.,]\d+)*)\s*(k|rb|ribu|jt|juta)?\b/))) {
    let n = m[1]; n = /^\d{1,3}(\.\d{3})+$/.test(n) ? n.replace(/\./g, '') : n.replace(',', '.');
    amount = parseFloat(n) * ({ k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6 }[m[2]] || 1);
  }
  if (cash) {
    const w = cash[1];
    const type = /deposit|setor|topup|top up/.test(w) ? 'deposit' : w === 'payout' ? 'payout' : 'withdrawal';
    const fields = { type, amount, transactionDate: f.date, accountId: f.accountId || '' };
    return { kind: 'cash', fields, missing: [!fields.accountId && 'akun', amount == null && 'nominal'].filter(Boolean) };
  }
  if (!(f.instrument || dir || res)) return { kind: null };
  const pl = res === 'win' ? Math.abs(amount) : res === 'loss' ? -Math.abs(amount) : res === 'be' ? 0 : null;
  const fields = { tradeDate: f.date, accountId: f.accountId || '', instrument: f.instrument || '', direction: dir || 'buy', result: res || '', profitLoss: isNaN(pl) ? null : pl };
  const missing = [!fields.accountId && 'akun', !fields.instrument && 'instrumen', !res && 'hasil (profit/loss/BE)',
    (res === 'win' || res === 'loss') && amount == null && 'nominal'].filter(Boolean);
  return { kind: 'trade', fields, missing, dirKnown: !!dir };
}
