/** Normalises Russian phone numbers to E.164 (+7XXXXXXXXXX). Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let d = digits;
  if (d.length === 11 && (d.startsWith("8") || d.startsWith("7"))) d = "7" + d.slice(1);
  else if (d.length === 10 && d.startsWith("9")) d = "7" + d;
  else return null;
  if (!/^79\d{9}$/.test(d)) return null;
  return "+" + d;
}

export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "";
  const m = e164.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : e164;
}
