import fs from 'fs';
import path from 'path';
import { AIService, AICategory } from '../../backend/src/services/ai.service';

interface TestItem {
  id: string;
  subject: string;
  body: string;
  groundTruthCategory: AICategory;
}

const CATEGORIES: AICategory[] = [
  'INTERESTED',
  'MEETING_BOOKED',
  'NOT_INTERESTED',
  'SPAM',
  'OUT_OF_OFFICE',
  'UNCATEGORIZED'
];

async function runClassificationEvaluation() {
  console.log('====================================================');
  console.log('🚀 Starting Gemini AI Email Classification Evaluation');
  console.log('====================================================');

  const datasetPath = path.resolve(__dirname, '../datasets/email_classification_testset.json');
  const dataset: TestItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  const aiService = new AIService();

  let correctCount = 0;
  let totalLatency = 0;
  let totalTokens = 0;

  // Initialize confusion matrix
  const confusionMatrix: Record<string, Record<string, number>> = {};
  CATEGORIES.forEach((cat1) => {
    confusionMatrix[cat1] = {};
    CATEGORIES.forEach((cat2) => {
      confusionMatrix[cat1][cat2] = 0;
    });
  });

  const results: any[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    console.log(`[${i + 1}/${dataset.length}] Evaluating: "${item.subject}"...`);

    const res = await aiService.categorizeEmail(item.subject, item.body);
    const predicted = res.category;
    const actual = item.groundTruthCategory;

    const isMatch = predicted === actual;
    if (isMatch) correctCount++;

    totalLatency += res.latencyMs;
    totalTokens += res.tokenCount;

    if (confusionMatrix[actual] && confusionMatrix[actual][predicted] !== undefined) {
      confusionMatrix[actual][predicted]++;
    }

    results.push({
      id: item.id,
      subject: item.subject,
      groundTruth: actual,
      predicted,
      confidence: res.confidence,
      match: isMatch,
      latencyMs: res.latencyMs,
      tokenCount: res.tokenCount
    });
  }

  const accuracy = (correctCount / dataset.length) * 100;
  const avgLatencyMs = totalLatency / dataset.length;

  // Calculate Precision, Recall, F1 per category
  const perCategoryMetrics: Record<string, { precision: number; recall: number; f1: number; count: number }> = {};
  let macroF1Sum = 0;

  CATEGORIES.forEach((cat) => {
    const tp = confusionMatrix[cat][cat];
    let fp = 0;
    let fn = 0;

    CATEGORIES.forEach((otherCat) => {
      if (otherCat !== cat) {
        fp += confusionMatrix[otherCat][cat]; // Predicted cat, but actually otherCat
        fn += confusionMatrix[cat][otherCat]; // Actually cat, but predicted otherCat
      }
    });

    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    macroF1Sum += f1;

    perCategoryMetrics[cat] = {
      precision: parseFloat(precision.toFixed(2)),
      recall: parseFloat(recall.toFixed(2)),
      f1: parseFloat(f1.toFixed(2)),
      count: dataset.filter(d => d.groundTruthCategory === cat).length
    };
  });

  const macroF1 = parseFloat((macroF1Sum / CATEGORIES.length).toFixed(2));

  const report = {
    timestamp: new Date().toISOString(),
    totalEvaluated: dataset.length,
    accuracyPercentage: parseFloat(accuracy.toFixed(2)),
    macroF1,
    averageLatencyMs: parseFloat(avgLatencyMs.toFixed(1)),
    totalTokensConsumed: totalTokens,
    perCategoryMetrics,
    confusionMatrix,
    details: results
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'classification-latest.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n====================================================');
  console.log('✅ CLASSIFICATION EVALUATION COMPLETE');
  console.log('====================================================');
  console.log(`Total Evaluated:      ${dataset.length}`);
  console.log(`Accuracy:             ${accuracy.toFixed(2)}%`);
  console.log(`Macro F1 Score:       ${macroF1}`);
  console.log(`Avg Latency:          ${avgLatencyMs.toFixed(1)} ms`);
  console.log(`Report Written To:    ${reportPath}`);
  console.log('====================================================\n');
}

runClassificationEvaluation().catch(console.error);
