import { performance } from "node:perf_hooks";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));
const baseUrl = String(args.get("base-url") || "http://127.0.0.1:3000").replace(/\/$/, "");
const stages = String(args.get("stages") || "25,50,100").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 250);
const requestsPerWorker = Math.min(20, Math.max(2, Number(args.get("requests-per-worker") || 5)));
// Public page GETs exercise the launch surface without creating accounts,
// scores, analytics, or other production data. CDN/API-specific testing can be
// added with --base-url after deployment while retaining this read-only guard.
const paths = ["/daily", "/leaderboard?difficulty=easy"];

if (!stages.length) throw new Error("Provide one or more concurrency stages up to 250.");

function percentile(values, fraction) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] ?? 0;
}

async function stage(concurrency) {
  const timings = [];
  const statuses = new Map();
  await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
    for (let request = 0; request < requestsPerWorker; request += 1) {
      const path = paths[(worker + request) % paths.length];
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, { headers: { "User-Agent": "GeoStats-launch-readiness/1.0" } });
        await response.arrayBuffer();
        timings.push(performance.now() - started);
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      } catch {
        timings.push(performance.now() - started);
        statuses.set(0, (statuses.get(0) ?? 0) + 1);
      }
    }
  }));
  const total = concurrency * requestsPerWorker;
  const failures = [...statuses].filter(([status]) => status < 200 || status >= 400).reduce((sum, [, count]) => sum + count, 0);
  return {
    concurrency,
    requests: total,
    p50Ms: Math.round(percentile(timings, .5)),
    p95Ms: Math.round(percentile(timings, .95)),
    maxMs: Math.round(Math.max(...timings)),
    errorRate: Number((100 * failures / total).toFixed(2)),
    statuses: Object.fromEntries([...statuses].sort(([left], [right]) => left - right)),
  };
}

console.log(`Read-only launch test: ${baseUrl}`);
for (const concurrency of stages) {
  const result = await stage(concurrency);
  console.log(JSON.stringify(result));
  if (result.errorRate > 1 || result.p95Ms > 3000) {
    console.error("Stopping: launch threshold exceeded (error rate >1% or p95 >3000ms).");
    process.exitCode = 1;
    break;
  }
}
