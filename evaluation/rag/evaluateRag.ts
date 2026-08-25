import fs from 'fs';
import path from 'path';
import { AIService } from '../../backend/src/services/ai.service';

async function runRagEvaluation() {
  console.log('====================================================');
  console.log('🚀 Starting RAG & Qdrant Groundedness Evaluation');
  console.log('====================================================');

  const aiService = new AIService();

  const testCases = [
    {
      subject: 'Custom Enterprise SLA Inquiry',
      body: 'Do you offer a guaranteed 99.99% uptime SLA and dedicated support channel for enterprise plans?',
      ragContext: [
        'Enterprise SLA Policy: Our platform provides a 99.99% uptime guarantee with 24/7 dedicated Slack channel support for enterprise customers.'
      ]
    },
    {
      subject: 'Data Residency and GDPR Compliance',
      body: 'Where is customer email data stored and are you GDPR compliant?',
      ragContext: [
        'Compliance Overview: All data is encrypted at rest using AES-256 and stored in AWS US-East / EU-Central regions. Our platform is fully GDPR compliant.'
      ]
    }
  ];

  const results: any[] = [];

  for (const tc of testCases) {
    // 1. Without RAG Context
    const startTimeNoRag = Date.now();
    const noRagReply = await aiService.generateReplies(tc.subject, tc.body, []);
    const latencyNoRag = Date.now() - startTimeNoRag;

    // 2. With RAG Context
    const startTimeRag = Date.now();
    const ragReply = await aiService.generateReplies(tc.subject, tc.body, tc.ragContext);
    const latencyRag = Date.now() - startTimeRag;

    results.push({
      subject: tc.subject,
      withoutRag: {
        professional: noRagReply.professional,
        latencyMs: latencyNoRag,
        isGrounded: noRagReply.isRagGrounded
      },
      withRag: {
        professional: ragReply.professional,
        latencyMs: latencyRag,
        isGrounded: ragReply.isRagGrounded,
        contextProvided: tc.ragContext
      }
    });
  }

  const report = {
    timestamp: new Date().toISOString(),
    evaluationType: 'RAG vs Non-RAG Groundedness',
    testCasesCount: testCases.length,
    results
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'rag-latest.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('✅ RAG EVALUATION COMPLETE');
  console.log(`Report Written To: ${reportPath}\n`);
}

runRagEvaluation().catch(console.error);
