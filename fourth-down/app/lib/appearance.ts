export type Appearance = "light" | "dark";
export const appearanceKey = "fourth-down-appearance";
export function readAppearance(): Appearance {
  try { return localStorage.getItem(appearanceKey) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
export function saveAppearance(value: Appearance) {
  try { localStorage.setItem(appearanceKey, value); } catch { /* Remains usable without storage. */ }
}
