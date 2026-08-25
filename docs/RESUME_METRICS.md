# Resume Metrics & Verification Evidence

This document contains **ONLY** metrics that have been empirically measured and verified via automated evaluation pipelines and executable benchmark scripts within this repository.

---

## Verified System Metrics Table

| Metric Category | Claimed Metric | Measured Value | Verification Test / Script | Evidence Artifact File |
| :--- | :--- | :--- | :--- | :--- |
| **Productivity Impact** | Manual Classification Time Reduction | **73.69%** | `npm run evaluate:productivity` | [`evaluation/reports/productivity-latest.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/evaluation/reports/productivity-latest.json) |
| **AI Classification** | Macro F1 Score | **53.86 (Fallback) / 88.4 (Gemini)** | `npm run evaluate:classification` | [`evaluation/reports/classification-latest.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/evaluation/reports/classification-latest.json) |
| **AI Classification** | Classification Accuracy | **55.00% (Fallback) / 91.2% (Gemini)** | `npm run evaluate:classification` | [`evaluation/reports/classification-latest.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/evaluation/reports/classification-latest.json) |
| **IMAP Parsing** | MIME Ingestion Throughput | **2,645.5 msgs/sec** | `npm run benchmark:imap` | [`benchmarks/results/imap.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/imap.json) |
| **API Latency** | REST API p50 Latency | **3.0 ms** | `npm run benchmark:api` | [`benchmarks/results/api.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/api.json) |
| **API Latency** | REST API p95 Latency | **11.0 ms** | `npm run benchmark:api` | [`benchmarks/results/api.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/api.json) |
| **API Latency** | REST API p99 Latency | **169.0 ms** | `npm run benchmark:api` | [`benchmarks/results/api.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/api.json) |
| **Vector Search** | Qdrant Vector Retrieval Latency | **7.0 ms** | `npm run benchmark:search` | [`benchmarks/results/search.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/search.json) |
| **RAG Pipeline** | End-to-End Grounded Generation | **352.0 ms** | `npm run benchmark:rag` | [`benchmarks/results/rag.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/rag.json) |
| **System Capacity** | Load Test Throughput (50 VUs) | **142.5 req/sec** | `npm run benchmark:load` | [`benchmarks/results/load.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/load.json) |
| **System Capacity** | Load Test Error Rate | **0.00%** | `npm run benchmark:load` | [`benchmarks/results/load.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/load.json) |

---

## Methodological Definitions

1. **Productivity Reduction Formula:**
   $$\text{Time Reduction \%} = \frac{\text{Baseline Manual Time} - \text{AI-Assisted Time}}{\text{Baseline Manual Time}} \times 100$$
   - Baseline: Measured manual human email reading & classification time (average 31.0s/email).
   - AI-Assisted: Gemini automated categorization latency + fast human verification (average 8.16s/email).

2. **Classification Macro F1 Score:**
   $$\text{Macro F1} = \frac{1}{N} \sum_{i=1}^{N} F1_i$$
   Computed across 6 categories: `INTERESTED`, `MEETING_BOOKED`, `NOT_INTERESTED`, `SPAM`, `OUT_OF_OFFICE`, `UNCATEGORIZED`.
