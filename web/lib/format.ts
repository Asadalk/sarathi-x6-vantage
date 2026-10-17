/** ₹ in lakh with one decimal, e.g. 1869000 → "₹18.7 L". */
export const inrL = (v: number, d = 1) => `₹${(v / 1e5).toFixed(d)} L`;

/** Indian-grouped rupees, e.g. 56002 → "₹56,002". */
export const inr = (v: number) => `${v < 0 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export const num = (v: number, d = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const signed = (s: string, v: number) => (v >= 0 ? `+${s}` : s.replace("-", "−"));
