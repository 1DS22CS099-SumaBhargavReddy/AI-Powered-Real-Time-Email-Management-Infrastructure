import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function runApiBenchmark() {
  console.log('====================================================');
  console.log('⚡ Starting REST API Latency & Throughput Benchmark');
  console.log('====================================================');

  const baseUrl = process.env.API_URL || 'http://localhost:3000/api';
  const iterations = 50;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await axios.get(`${baseUrl}/health/live`, { timeout: 5000 });
      const duration = Date.now() - start;
      latencies.push(duration);
    } catch (e) {
      // Record latency even if server returns unready
      latencies.push(Date.now() - start);
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  const result = {
    timestamp: new Date().toISOString(),
    benchmark: 'API Latency Benchmark',
    totalRequests: iterations,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    averageMs: parseFloat(avg.toFixed(2))
  };

  const resultsDir = path.resolve(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(resultsDir, 'api.json'), JSON.stringify(result, null, 2));

  console.log(`p50 Latency:  ${p50} ms`);
  console.log(`p95 Latency:  ${p95} ms`);
  console.log(`p99 Latency:  ${p99} ms`);
  console.log('✅ API BENCHMARK COMPLETE\n');
}

runApiBenchmark().catch(console.error);
