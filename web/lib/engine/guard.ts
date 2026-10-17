import type { Decision } from "./sim";

/** Reject model output containing any number that does not appear in the facts. */
export function onlyFactNumbers(text: string, d: Decision): boolean {
  const allowed = new Set<string>(["0", "00", "1", "2"]);
  for (const v of Object.values(d.facts)) if (typeof v === "number") allowed.add(String(v));
  allowed.add(String(d.facts.hour).padStart(2, "0"));
  const nums = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return nums.every((n) => allowed.has(n) || allowed.has(String(Number(n))));
}
