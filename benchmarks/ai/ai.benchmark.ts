import fs from 'fs';
import path from 'path';
import { AIService } from '../../backend/src/services/ai.service';

async function runAiBenchmark() {
  console.log('====================================================');
  console.log('⚡ Starting AI Inference & Latency Benchmark');
  console.log('====================================================');

  const aiService = new AIService();
  const iterations = 5;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const res = await aiService.categorizeEmail(
      `Benchmark Email #${i}`,
      'We are looking to buy enterprise email management software with high scale.'
    );
    latencies.push(res.latencyMs);
  }

  const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  const result = {
    timestamp: new Date().toISOString(),
    benchmark: 'Gemini AI Inference Benchmark',
    totalIterations: iterations,
    averageLatencyMs: parseFloat(avgMs.toFixed(2)),
    latencies
  };

  const resultsDir = path.resolve(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(resultsDir, 'ai.json'), JSON.stringify(result, null, 2));

  console.log(`Average Gemini Inference Latency: ${avgMs.toFixed(1)} ms`);
  console.log('✅ AI BENCHMARK COMPLETE\n');
}

runAiBenchmark().catch(console.error);
