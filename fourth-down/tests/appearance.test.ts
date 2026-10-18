import { test } from "node:test";
import assert from "node:assert/strict";
import { readAppearance, saveAppearance, appearanceKey } from "../app/lib/appearance.ts";
test("appearance defaults light, persists independently of colorway, and tolerates blocked storage", () => {
  const values = new Map<string,string>([["fourth-down-theme", "prime"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }});
  assert.equal(readAppearance(), "light");
  saveAppearance("dark"); assert.equal(readAppearance(), "dark");
  assert.equal(values.get("fourth-down-theme"), "prime");
  saveAppearance("light"); assert.equal(readAppearance(), "light");
  values.set(appearanceKey, "invalid"); assert.equal(readAppearance(), "light");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("blocked"); }});
  assert.equal(readAppearance(), "light"); assert.doesNotThrow(() => saveAppearance("dark"));
  Reflect.deleteProperty(globalThis, "localStorage");
});
