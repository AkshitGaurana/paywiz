export const money = (n: number | null, currency: string) => {
  if (n === null) return "—";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n); } catch { return `${currency} ${n.toFixed(2)}`; }
};
export const maskNumber = (last4: string) => (last4 ? `•••• ${last4}` : "•••• ••••");
export const fmtDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
