import fs from 'fs';
import path from 'path';
import { ElasticsearchService } from '../../backend/src/services/elasticsearch.service';
import { VectorService } from '../../backend/src/services/vector.service';

async function runSearchBenchmark() {
  console.log('====================================================');
  console.log('⚡ Starting Full-Text & Vector Search Benchmark');
  console.log('====================================================');

  const esService = new ElasticsearchService();
  const vectorService = new VectorService();

  const query = 'enterprise API pricing';
  const mockVector = new Array(768).fill(0.1);

  // 1. Elasticsearch Benchmark
  const esStart = Date.now();
  await esService.searchEmails({ userId: 'bench-user', query });
  const esDuration = Date.now() - esStart;

  // 2. Qdrant Vector Benchmark
  const qdrantStart = Date.now();
  await vectorService.searchSimilar('bench-user', mockVector, 5);
  const qdrantDuration = Date.now() - qdrantStart;

  const result = {
    timestamp: new Date().toISOString(),
    benchmark: 'Search Performance Benchmark',
    elasticsearchLatencyMs: esDuration,
    qdrantVectorLatencyMs: qdrantDuration
  };

  const resultsDir = path.resolve(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(resultsDir, 'search.json'), JSON.stringify(result, null, 2));

  console.log(`Elasticsearch Latency: ${esDuration} ms`);
  console.log(`Qdrant Vector Latency: ${qdrantDuration} ms`);
  console.log('✅ SEARCH BENCHMARK COMPLETE\n');
}

runSearchBenchmark().catch(console.error);
