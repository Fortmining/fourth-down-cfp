export type MeasuredBudget = {
  observedAt: string;
  redisMonthlyLimit: number;
  redisCommandsUsed: number;
  redisCommandsPerDay: number[];
  storageBytesUsed: number;
  storageLimitBytes: number;
  qstashDailyLimit: number;
  qstashDailyAttempts: number;
  vercelCpuHoursUsed: number | null;
  vercelCpuHoursLimit: number;
};
export function assessOperations(
  m: MeasuredBudget,
  extraCommandsPerCheck: number,
  meaningfulWritesPerDay: number,
  cpuMsPerCheck: number,
) {
  if (
    [
      m.redisMonthlyLimit,
      m.redisCommandsUsed,
      m.storageBytesUsed,
      m.storageLimitBytes,
      m.qstashDailyLimit,
      m.qstashDailyAttempts,
      m.vercelCpuHoursLimit,
      extraCommandsPerCheck,
      meaningfulWritesPerDay,
      cpuMsPerCheck,
      ...m.redisCommandsPerDay,
    ].some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isFinite(Date.parse(m.observedAt))
  )
    throw Error("Invalid measured budget");
  const runs = 360,
    days = 30;
  const dailyPeak = Math.max(0, ...m.redisCommandsPerDay);
  const additional =
    extraCommandsPerCheck * runs * days + meaningfulWritesPerDay * days;
  const projected = dailyPeak * days + additional;
  const cpuHours = (cpuMsPerCheck * runs * days) / 3600000;
  const issues: string[] = [];
  if (!m.redisCommandsPerDay.length)
    issues.push("No complete daily command observations");
  if (projected > m.redisMonthlyLimit * 0.8)
    issues.push("Peak-day monthly extrapolation exceeds 80% Redis allowance");
  if (m.qstashDailyAttempts > m.qstashDailyLimit * 0.8)
    issues.push("QStash attempts exceed 80% allowance");
  if (m.storageBytesUsed + 64 * 1024 * 1024 > m.storageLimitBytes * 0.8)
    issues.push("Snapshot storage reserve exceeds allowance");
  if (m.vercelCpuHoursUsed === null)
    issues.push("Actual Vercel CPU usage unavailable");
  else if (m.vercelCpuHoursUsed + cpuHours > m.vercelCpuHoursLimit * 0.8)
    issues.push("CPU estimate exceeds 80% allowance");
  return {
    safeToActivate: issues.length === 0,
    issues,
    additionalRedisCommandsPer30Days: additional,
    peakDayProjection: projected,
    illustrativeCpuHours: cpuHours,
    extraQstashDeliveries: 0,
    extraSchedules: 0,
    measured: m,
  };
}
