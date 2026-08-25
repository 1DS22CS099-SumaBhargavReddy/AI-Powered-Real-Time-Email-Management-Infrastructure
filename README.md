# AI-Powered Real-Time Email Management Infrastructure

A production-grade, distributed, AI-powered email management and intelligence platform. Built with Node.js, TypeScript, Express, PostgreSQL, Redis, BullMQ, Elasticsearch 8.x, Qdrant Vector DB, Google Gemini AI, and React.

---

## 1. System Architecture Diagram

```
                    ┌────────────────────────────────────────┐
                    │      React UI (Modular & Virtualized) │
                    └───────────────────┬────────────────────┘
                                        │ REST / WebSockets (Socket.io)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │  Express API Gateway & Request Logger  │
                    └────┬──────────────┬──────────────┬─────┘
                         │              │              │
        ┌────────────────▼┐     ┌───────▼──────┐    ┌──▼─────────────┐
        │ PostgreSQL      │     │ Redis        │    │ Elasticsearch  │
        │ Source of Truth │     │ Queue/Lock   │    │ Full-Text      │
        └─────────────────┘     └───────┬──────┘    └────────────────┘
                                        │ BullMQ Jobs
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │          Worker Processes (BullMQ)       │
                  ├──────────────┬──────────────┬────────────┤
                  │ IMAP Sync    │ AI Classify  │ RAG Embed  │
                  │ Worker       │ Worker       │ Worker     │
                  └──────────────┴──────────────┴────────────┘
```

---
<img width="1891" height="853" alt="image" src="https://github.com/user-attachments/assets/a8645e6f-99df-44ca-9075-492b6650f031" />

## 2. Technology Stack & Design Decisions

| Subsystem | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **API Gateway & Core** | Node.js + Express 5 + TypeScript | Non-blocking I/O event loop, strict typings, structured request logging (`requestId`). |
| **Primary Source of Truth** | PostgreSQL + Prisma ORM | Durable relational storage with ACID guarantees, foreign keys, and indexes. |
| **Job Queue & Locking** | Redis 7 + BullMQ | Decoupled background execution for email ingestion, Gemini AI, and vector embeddings. |
| **Full-Text Search** | Elasticsearch 8.x | Sub-25ms tokenized search across millions of emails with custom analyzers and highlighting. |
| **Vector DB / RAG** | Qdrant Vector DB | 768-dim vector index (`text-embedding-004`) with `userId` payload filtering for grounded replies. |
| **AI Classification** | Google Gemini (`@google/genai`) | Structured JSON outputs, schema validation, confidence scoring, and fallback handling. |
| **Real-Time Updates** | Socket.io (WebSockets) | Instant push notifications for synced emails, classification state updates, and queue status. |
| **Frontend UI** | React 18 + Vite + Tailwind CSS | High-density operations dashboard with hotkeys (`J`/`K`/`R`), dark theme, and modular views. |

---

## 3. Key Subsystem Specifications

### IMAP Synchronization & Idempotency
- **Daemon Engine:** Multi-account persistent IMAP IDLE connections using `ImapFlow`.
- **State Machine:** Explicit state tracking (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `SYNCING`, `IDLE`, `RECONNECTING`, `FAILED`, `STOPPED`).
- **Idempotency:** Composite key uniqueness on `[userId, messageId]` and `[accountId, mailboxId, uid]`. Prevents duplicate email processing on network reconnects.
- **Fault Tolerance:** Exponential backoff with random jitter up to 60s for reconnection.

### AI Classification & Gemini Pipeline
- **Structured Categories:** `INTERESTED`, `MEETING_BOOKED`, `NOT_INTERESTED`, `SPAM`, `OUT_OF_OFFICE`, `UNCATEGORIZED`.
- **Confidence Scoring:** Outputs confidence score (0.0 to 1.0) along with 1-2 sentence key point summary.
- **Model Versioning:** Configured with `gemini-1.5-flash` (`v2.0-gemini-structured`).

### RAG & Qdrant Grounded Replies
- **Embedding Model:** Google Gemini `text-embedding-004` (768 dimensions).
- **Grounded Retrieval:** Searches Qdrant for top-K historical thread context with `userId` isolation prior to generating reply suggestions (`professional`, `friendly`, `short`).

---

## Empirical Evidence & Verified Resume Metrics

Every metric below is backed by an automated evaluation script and evidence report file within the codebase:

| Metric Category | Claimed Metric | Measured Value | Verification Test / Script | Evidence Artifact File |
| :--- | :--- | :--- | :--- | :--- |
| **Productivity Impact** | Manual Classification Time Reduction | **73.69%** | `npm run evaluate:productivity` | [`evaluation/reports/productivity-latest.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/evaluation/reports/productivity-latest.json) |
| **IMAP Parsing** | MIME Ingestion Throughput | **2,645.5 msgs/sec** | `npm run benchmark:imap` | [`benchmarks/results/imap.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/imap.json) |
| **REST API Latency** | API p50 / p95 Latency | **p50: 3ms \| p95: 11ms** | `npm run benchmark:api` | [`benchmarks/results/api.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/api.json) |
| **Vector Retrieval** | Qdrant Vector Search Latency | **7.0 ms** | `npm run benchmark:search` | [`benchmarks/results/search.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/search.json) |
| **RAG Pipeline** | End-to-End Grounded Reply Latency | **352.0 ms** | `npm run benchmark:rag` | [`benchmarks/results/rag.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/rag.json) |
| **System Capacity** | Load Capacity (50 Concurrent VUs) | **142.5 req/sec (0% error)** | `npm run benchmark:load` | [`benchmarks/results/load.json`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/benchmarks/results/load.json) |

---

## 5. Local Setup & Execution Guide

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### Quickstart Command Steps

1. **Clone & Install Dependencies**
   ```bash
   git clone <repository-url>
   cd AI-Powered-Real-Time-Email-Management-Infrastructure
   npm run install:all
   ```

2. **Configure Environment Variables**
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Start Infrastructure Services (Postgres, Redis, Qdrant, Elasticsearch)**
   ```bash
   npm run docker:up
   ```

4. **Initialize Database Schemas & Migrations**
   ```bash
   cd backend && npx prisma db push
   ```

5. **Start Application (API + BullMQ Workers + React Frontend)**
   ```bash
   npm run dev
   ```

---

## 6. Executing Test Suites, AI Evaluations & Benchmarks

```bash
# Run Unit & Integration Test Suite
npm test

# Run TypeScript Type Checker & Linter
npm run typecheck
npm run lint

# Run AI Classification Evaluation
npm run evaluate:classification

# Run RAG Groundedness Evaluation
npm run evaluate:rag

# Run Productivity Benchmark
npm run evaluate:productivity

# Run Executable Benchmarks
npm run benchmark:api
npm run benchmark:search
npm run benchmark:imap
npm run benchmark:ai
npm run benchmark:rag
npm run benchmark:load
```

---

## 7. Production Observability & Monitoring

- **Prometheus Metrics:** Available at `http://localhost:3000/metrics`
- **Health Checks:**
  - Liveness: `http://localhost:3000/health/live`
  - Readiness: `http://localhost:3000/health/ready`
- **Queue Status:** `http://localhost:3000/queues/status`

---

## 8. Documentation Index

- [`docs/ARCHITECTURE_AUDIT.md`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/docs/ARCHITECTURE_AUDIT.md) — Comprehensive initial codebase audit report.
- [`docs/RESUME_METRICS.md`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/docs/RESUME_METRICS.md) — Resume-ready metrics table backed by evidence JSON files.
- [`docs/AI_COST_ANALYSIS.md`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/docs/AI_COST_ANALYSIS.md) — Token consumption model and cost optimization strategies.
- [`docs/ADR/`](file:///c:/Users/K.Bhargav%20Reddy/Desktop/ReachIbox-Email-Assignment-main/docs/ADR/) — Architecture Decision Records (ADR-001 through ADR-005).
