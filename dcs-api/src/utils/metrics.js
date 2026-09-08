const MAX_SAMPLES = 10000;

const samples = {
  validate: [],
};

export function recordLatency(endpoint, ms) {
  const bucket = samples[endpoint];
  if (!bucket) return;
  bucket.push(ms);
  if (bucket.length > MAX_SAMPLES) bucket.splice(0, bucket.length - MAX_SAMPLES);
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function getMetrics() {
  const out = {};
  for (const [endpoint, bucket] of Object.entries(samples)) {
    if (bucket.length === 0) {
      out[endpoint] = { samples: 0, p50_ms: null, p95_ms: null, p99_ms: null, mean_ms: null };
      continue;
    }
    const sorted = [...bucket].sort((a, b) => a - b);
    const sum = bucket.reduce((acc, v) => acc + v, 0);
    out[endpoint] = {
      samples: bucket.length,
      p50_ms: percentile(sorted, 50),
      p95_ms: percentile(sorted, 95),
      p99_ms: percentile(sorted, 99),
      mean_ms: Math.round((sum / bucket.length) * 10) / 10,
    };
  }
  return out;
}