import fs from 'fs';
import path from 'path';
import { AIService } from '../../backend/src/services/ai.service';
import { VectorService } from '../../backend/src/services/vector.service';

async function runRagBenchmark() {
  console.log('====================================================');
  console.log('⚡ Starting End-to-End RAG Pipeline Benchmark');
  console.log('====================================================');

  const aiService = new AIService();
  const vectorService = new VectorService();

  const startTime = Date.now();

  // Step 1: Generate Query Vector
  const vectorStart = Date.now();
  const queryVector = await aiService.generateEmbedding('Enterprise SLA and SOC2 compliance');
  const vectorLatencyMs = Date.now() - vectorStart;

  // Step 2: Retrieve from Qdrant
  const qdrantStart = Date.now();
  const hits = await vectorService.searchSimilar('bench-user', queryVector, 3);
  const qdrantLatencyMs = Date.now() - qdrantStart;

  // Step 3: Generate Reply via Gemini
  const genStart = Date.now();
  const replies = await aiService.generateReplies(
    'Enterprise SLA Inquiry',
    'Do you support enterprise SOC2 compliance?',
    hits.map(h => h.text)
  );
  const genLatencyMs = Date.now() - genStart;

  const totalMs = Date.now() - startTime;

  const result = {
    timestamp: new Date().toISOString(),
    benchmark: 'RAG Pipeline Benchmark',
    totalPipelineLatencyMs: totalMs,
    vectorEmbeddingLatencyMs: vectorLatencyMs,
    qdrantSearchLatencyMs: qdrantLatencyMs,
    geminiGenerationLatencyMs: genLatencyMs,
    isRagGrounded: replies.isRagGrounded
  };

  const resultsDir = path.resolve(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(resultsDir, 'rag.json'), JSON.stringify(result, null, 2));

  console.log(`Total RAG Pipeline Latency: ${totalMs} ms`);
  console.log(`- Vector Embedding:          ${vectorLatencyMs} ms`);
  console.log(`- Qdrant Context Search:    ${qdrantLatencyMs} ms`);
  console.log(`- Gemini Generation:        ${genLatencyMs} ms`);
  console.log('✅ RAG BENCHMARK COMPLETE\n');
}

runRagBenchmark().catch(console.error);
