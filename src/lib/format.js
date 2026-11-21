// Small formatting and parsing helpers shared by the audit, letter and UI code.

// Parses user-typed money: "$1,234.50", "1234.5", "(50.00)", "-50". Returns null if not a number.
export function toNum(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/^-/, '').replace(/[()$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function money(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  // "+ 0" turns -0 into 0 so we never print "-$0.00".
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n + 0);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-09-12" -> "Sep 12, 2026". Parsed by hand so time zones can't shift the day.
export function fmtDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function todayISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
