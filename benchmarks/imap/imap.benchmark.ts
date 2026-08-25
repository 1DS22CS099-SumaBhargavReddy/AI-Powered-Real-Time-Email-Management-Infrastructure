import fs from 'fs';
import path from 'path';
import { EmailParserService } from '../../backend/src/services/imap/emailParser.service';

async function runImapBenchmark() {
  console.log('====================================================');
  console.log('⚡ Starting IMAP MIME Ingestion Throughput Benchmark');
  console.log('====================================================');

  const rawSample = `From: "Alex Sender" <alex@example.com>
To: "User" <user@emailinfra.internal>
Subject: Benchmark Test Message
Content-Type: text/plain; charset=utf-8

This is a raw MIME sample email message used to benchmark the parsing throughput of the EmailParserService parser.`;

  const iterations = 500;
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    await EmailParserService.parseMime(rawSample, 'user@emailinfra.internal');
  }

  const totalTimeMs = Date.now() - start;
  const msgPerSec = parseFloat(((iterations / totalTimeMs) * 1000).toFixed(2));

  const result = {
    timestamp: new Date().toISOString(),
    benchmark: 'IMAP MIME Parser Benchmark',
    totalMessagesParsed: iterations,
    totalTimeMs,
    throughputMessagesPerSec: msgPerSec
  };

  const resultsDir = path.resolve(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(resultsDir, 'imap.json'), JSON.stringify(result, null, 2));

  console.log(`Parsed ${iterations} messages in ${totalTimeMs} ms`);
  console.log(`Throughput: ${msgPerSec} msg/sec`);
  console.log('✅ IMAP BENCHMARK COMPLETE\n');
}

runImapBenchmark().catch(console.error);
