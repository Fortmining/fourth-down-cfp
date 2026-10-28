import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { runShadow } from "../app/lib/playoff/engine.ts";
const root = process.env.SHADOW_OUTPUT;
if (!root) throw Error("SHADOW_OUTPUT required");
const input = JSON.parse(fs.readFileSync(root + "/inputs.json"));
const runs = [];
for (let i = 0; i < 10; i++) {
  const cpu = process.cpuUsage(),
    start = performance.now();
  const confirmed = runShadow(input),
    live = runShadow(input, undefined, true, confirmed.id);
  const delta = process.cpuUsage(cpu);
  runs.push({
    wallMs: performance.now() - start,
    cpuMs: (delta.user + delta.system) / 1000,
    confirmedId: confirmed.id,
    provisionalId: live.id,
  });
}
const sorted = runs.map((r) => r.cpuMs).sort((a, b) => a - b),
  median = sorted[5],
  p95 = sorted[9];
const report = {
  measured:
    "local Node process; confirmed plus provisional computation; excludes network/provider/Redis latency",
  runs,
  medianCpuMs: median,
  p95CpuMs: p95,
  existingScheduleRunsPer30Days: 10800,
  illustrativeCpuHoursPer30Days: (median * 10800) / 3600000,
  productionFunctionMeasurement: false,
  redisCommands: 0,
  qstashDeliveries: 0,
};
fs.writeFileSync(root + "/profile.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
