# Architecture Audit: AI-Powered Real-Time Email Management Infrastructure

**Audit Date:** August 24, 2026  
**Auditor:** Principal Software & AI Systems Engineering Architecture Team  
**Repository State:** Initial Prototype Audit  

---

## 1. Current Architecture

The codebase currently functions as a prototype Node.js / Express monolith paired with a monolithic React (Vite) frontend.

```
                    ┌────────────────────────────────┐
                    │      React Frontend (Vite)     │
                    │      Single 45KB App.tsx       │
                    └───────────────┬────────────────┘
                                    │ HTTP REST / Socket.io
                                    ▼
                    ┌────────────────────────────────┐
                    │    Node.js / Express Monolith  │
                    │          (src/server.ts)       │
                    └───────┬───────────────┬────────┘
                            │               │
            ┌───────────────▼┐             ▼
            │ PostgreSQL     │     ┌─────────────────┐
            │ Prisma Client  │     │ Ollama / Chroma │
            └────────────────┘     │ (Inconsistent)  │
                                   └─────────────────┘
```

* **Frontend:** Built with React 18, Vite, Tailwind CSS, Lucide React, and Radix/shadcn UI components. However, all view, state, real-time, and component logic is coupled in a single 45KB `App.tsx` file. Stubs exist for components (`EmailDetail.tsx`, `EmailList.tsx`), but they are unused.
* **Backend API Gateway & Application:** Express 5 app (`server.ts`). Serves REST endpoints for authentication and email operations.
* **Database / Persistence:** PostgreSQL accessed via Prisma ORM (`prisma/schema.prisma`).
* **AI & Vector Service:** Inconsistently configured. Code references Ollama (`http://localhost:11434`) and ChromaDB in service implementations, while documentation and `docker-compose.yml` claim Google Gemini and Qdrant vector DB.
* **IMAP Sync:** Synchronous inline IMAP sync initiated via `OAuthSyncService.syncAccount` upon account connection, without durable background queue worker or retry mechanism.
* **Elasticsearch:** Declared in `package.json` and `docker-compose.yml`, but completely absent from the actual backend server and API pipeline.

---

## 2. Current Data Flow

```
[External Email Server (IMAP)] ──(ImapFlow)──► [OAuthSyncService] ──► [LangGraph emailPipeline]
                                                                            │
      ┌─────────────────────────────────────────────────────────────────────┤
      ▼                                                                     ▼
[Prisma / PostgreSQL]                                            [Vector DB / Chroma/Qdrant]
 (User, EmailAccount, Email, AIReply)                             (Embeddings - BGE / Random)
```

1. External email server delivers email via IMAP.
2. `OAuthSyncService.fetchImapEmails` opens connection to IMAP inbox, reads message source using `mailparser`.
3. In-memory messages are passed to LangGraph pipeline (`emailPipeline.ts`).
4. Pipeline runs sequential nodes: `categorize` -> `summarize` -> `generateReplies` -> `persist`.
5. Persistence stores records in PostgreSQL (`Email`, `AIReply`) and upserts vector to vector storage.

---

## 3. Current Request Flow

1. Client sends HTTP REST request to `/api/emails`, `/api/emails/search`, or `/api/emails/:id/suggest-reply`.
2. Middleware `authenticateToken` checks JWT token signed with JWT_SECRET (with insecure default fallback `'super-secret-jwt-key'`).
3. Express controller `EmailController` handles request:
   * `/api/emails`: Reads directly from PostgreSQL with basic pagination.
   * `/api/emails/search`: Generates query vector using `aiService.generateEmbedding`, queries Qdrant/Chroma vector DB for top-K IDs, then looks up emails in PostgreSQL. *Note: Full-text search via Elasticsearch is completely missing from API routes.*
   * `/api/emails/:id/categorize` & `/api/emails/:id/suggest-reply`: Executes AI calls inline during the HTTP request cycle, causing HTTP timeout risks.

---

## 4. Current Email Synchronization Flow

* Connection is initiated via `POST /api/accounts/connect`.
* Connection is tested synchronously with `ImapFlow`.
* If successful, credentials are encrypted via AES-256-CBC and stored in PostgreSQL (`EmailAccount`).
* `OAuthSyncService.syncAccount` is called asynchronously (fire-and-forget promise).
* Only the last 15 emails are fetched from `INBOX`.
* No IMAP IDLE persistent background connection daemon exists.
* Reconnect logic, exponential backoff, jitter, UID validity tracking, and mailbox state persistence are missing.

---

## 5. Current AI Pipeline

* Handled by `AIService` (`ai.service.ts`) using LangGraph (`emailPipeline.ts`).
* Relies on local Ollama calls (`/api/generate` and `/api/embeddings`) with mock fallbacks when Ollama is unavailable.
* Prompts return unformatted strings or uncontrolled JSON.
* Prompt categories (`Work`, `Personal`, `Finance`, etc.) conflict with required production categories (`INTERESTED`, `MEETING_BOOKED`, `NOT_INTERESTED`, `SPAM`, `OUT_OF_OFFICE`, `UNCATEGORIZED`).
* Missing token usage tracking, cost tracking, model versioning, confidence scoring, and structured output schema enforcement.

---

## 6. Current RAG Pipeline

* Vector embedding created via `VectorService.addEmailVector` which calls `AIService.generateEmbedding` (falling back to 384-dimension random math vectors).
* Ingested text is naive string concatenation (`Subject: ... From: ... Body: ...`).
* Retrieval (`searchSimilar`) filters by `userId` and returns top K documents.
* `suggestReply` controller calls `aiService.generateReplies` directly without retrieving RAG context chunks from Qdrant! RAG pipeline is disconnected in actual execution.

---

## 7. Current Deployment Architecture

* `docker-compose.yml` configures 4 containers: `postgres` (port 5433:5432), `email-infra-qdrant` (6333), `backend` (3000), `frontend` (80).
* Backend container points to `OLLAMA_URL=http://host.docker.internal:11434` which requires an external host process.
* Docker setup lacks Redis, Elasticsearch container, healthchecks, resource limits, multi-stage builds, non-root user execution, and environment variable validation.

---

## 8. Problems Discovered (Categorized by Severity)

### P0 — Critical / Correctness / Security / Data-Loss

1. **Security Vulnerability (Hardcoded JWT & Encryption Secrets):** `JWT_SECRET` defaults to `'super-secret-jwt-key'` in controller/server; `ENCRYPTION_KEY` defaults to `'email-infra-temp-encryption-key-32'` in `crypto.ts`.
2. **Data Loss / Idempotency Flaw:** `messageId` constructed as `${host}-${message.uid}` inside IMAP sync. UID values in IMAP are mailbox-specific and change if `UIDVALIDITY` changes. Emails are upserted on `userId_messageId`, leading to duplicate writes or missing emails.
3. **Disconnected Search Subsystem:** Elasticsearch service is mentioned in docs and installed in `package.json`, but no Elasticsearch client, index mapping, sync handler, or search endpoint exists in the backend code.
4. **Disconnected RAG Pipeline:** `suggestReply` API route ignores vector context entirely and invokes ungrounded LLM prompts.
5. **Silent Fallbacks Masking Failures:** AI and Vector services catch network errors and silently return random mock vectors and hardcoded string responses, corrupting vector index and AI analytics.
6. **Data Leakage in Multi-Tenancy:** `AIReply.deleteMany` and vector deletion operations lack strict owner filtering checks in several helper paths.

### P1 — Production-Blocking

1. **No Durable Queue Infrastructure:** Heavy AI processing and email parsing run directly inside HTTP handlers or unmonitored promises without BullMQ/Redis queues, leading to thread blocking, process crashes, and unrecoverable job loss.
2. **Missing IMAP IDLE & Background Daemon:** Real-time email sync relies on one-shot HTTP connection triggers rather than a fault-tolerant IMAP IDLE worker daemon with automatic reconnect and exponential backoff.
3. **Inconsistent AI Stack:** Code uses Ollama local calls with arbitrary models (`qwen:14b`, `llama3.1:8b`), while project requirements mandate Google Gemini API integration (`@google/genai`).
4. **Monolithic Unusable Frontend Structure:** `App.tsx` is 45KB with inline component definitions, lacking modular architecture, state management, virtualization, error boundaries, or real-time reconnect handling.
5. **No Evaluation & Benchmark Pipeline:** Evaluation metrics, F1 scores, productivity benchmarks, load testing, and test suites are entirely absent.

### P2 — Significant Architecture & Maintainability Issues

1. **Missing Unified Database Schemas:** Prisma schema lacks models for `Mailbox`, `SyncState`, `AIClassification`, `ProcessingJob`, `AuditLog`, `EmailLabel`, `Attachment`.
2. **No Structured Output Validation:** Gemini responses are not constrained with JSON Schema or Zod validation.
3. **Lack of Observability:** Logger (`pino-pretty`) lacks JSON structured formatting, request ID correlation tracing, Prometheus metrics export (`/metrics`), or health endpoints (`/health/live`, `/health/ready`).
4. **Hardcoded Environment Config:** Port numbers, database URLs, and API endpoints are hardcoded in frontend and backend.

### P3 — Improvement & Polish

1. **Missing Keyboard Shortcuts & Modern UX:** Frontend lacks inbox hotkeys (`j`/`k` navigation, `r` reply, `e` archive), virtualized rendering for 10k+ emails, and rich feedback components.
2. **Missing API Documentation:** OpenAPI / Swagger specifications are absent.

---

## 9. Risks

1. **Rate Limiting / Quota Exhaustion:** Sending un-throttled batch requests to Google Gemini without Redis rate limiting will cause 429 quota exhaustion.
2. **Data Consistency Risks:** Lack of database transactions during email + classification + vector persistence can leave orphans across Postgres, Elasticsearch, and Qdrant.
3. **Memory Leaks:** Long-running IMAP sockets without explicit memory management and cleanup will crash Node.js runtimes.

---

## 10. Recommended Target Architecture

```
                    ┌─────────────────────────────────────────┐
                    │      React UI (Modular & Virtualized)   │
                    └────────────────────┬────────────────────┘
                                         │ REST / WebSockets (Socket.io)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │   Express API Gateway & REST Routes    │
                    └────┬──────────────┬──────────────┬──────┘
                         │              │              │
        ┌────────────────▼┐     ┌───────▼──────┐    ┌──▼─────────────┐
        │ PostgreSQL      │     │ Redis        │    │ Elasticsearch  │
        │ Source of Truth │     │ Queue/Lock   │    │ Full Text      │
        └─────────────────┘     └───────┬──────┘    └────────────────┘
                                        │ BullMQ Jobs
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │          Worker Processes (BullMQ)        │
                  ├──────────────┬──────────────┬─────────────┤
                  │ IMAP Sync    │ AI Classify  │ RAG Embed   │
                  │ Worker       │ Worker       │ Worker      │
                  └──────────────┴──────────────┴─────────────┘
```

* **PostgreSQL:** Durable relational store for Users, Accounts, Mailboxes, Emails, Sync States, Classifications, Replies, and Audit Logs.
* **Elasticsearch 8.x:** Advanced full-text search with customized analyzers, mappings, highlighting, and strict filtering.
* **Qdrant Vector DB:** Context vector store with 768-dim Google Gemini embeddings and payload filtering (`userId`, `accountId`).
* **Redis + BullMQ:** Queue backend for decoupled job execution (`email-sync`, `email-parse`, `email-classify`, `email-embed`, `reply-generation`).
* **Google Gemini API (`@google/genai`):** Structured output classification (`INTERESTED`, `MEETING_BOOKED`, `NOT_INTERESTED`, `SPAM`, `OUT_OF_OFFICE`, `UNCATEGORIZED`) with token tracking and retries.

---

## 11. Migration Plan

* **Phase 1: Architecture Audit & Strategy Definition** (Completed via this document & Implementation Plan).
* **Phase 2: Database Schema & Core Architecture Foundations** (PostgreSQL schema upgrade, Redis integration, BullMQ worker architecture).
* **Phase 3: IMAP Reliability & Idempotent Ingestion Engine** (Fault-tolerant IMAP IDLE manager, UIDVALIDITY tracking, idempotent message hashing).
* **Phase 4: AI Classification & Versioned Evaluation Pipeline** (Gemini structured outputs, evaluation dataset, precision/recall/F1 test framework).
* **Phase 5: Qdrant RAG & Semantic Context Pipeline** (Gemini text embeddings, semantic search, grounded context retrieval for replies).
* **Phase 6: Elasticsearch Full-Text Indexing & Search Engine** (Index lifecycle, mappings, multi-field search API).
* **Phase 7: Decoupled Queue Worker System** (BullMQ job handlers with exponential backoff and dead-letter queues).
* **Phase 8: Security, Auth & Observability Hardening** (JWT auth, bcrypt, rate-limiting, Prometheus metrics, JSON logging, health checks).
* **Phase 9: Real-Time WebSockets & Modern Virtualized UX** (Modularized React components, WebSocket state sync, virtualized email list, AI composer).
* **Phase 10: Comprehensive Testing, Load Benchmarking & Verification** (Unit, integration, E2E Playwright/Vitest, k6 load benchmarks, productivity evaluation report).

---

## 12. Testing Strategy

```
           / \
          /   \  E2E Tests (Playwright / Cypress)
         /-----\  
        /         \  Integration Tests (Supertest, Postgres, Redis, Qdrant, ES)
       /-----------\  
      /               \  Unit Tests (Vitest / Jest for Services, Parsers, Cleaners)
     /-----------------\
```

1. **Unit Tests:** Validate email body cleaning, MIME parsing, prompt construction, confidence scoring, security sanitization, and crypto utilities.
2. **Integration Tests:** Verify PostgreSQL Prisma queries, Redis queue job pushes, Qdrant payload filters, Elasticsearch mappings, and Express route responses.
3. **E2E Tests:** End-to-end user signup, email account connection, real-time socket events, inbox filtering, AI reply generation, and search.
4. **AI & RAG Evaluation:** Automated dataset benchmark assessing classification Accuracy, Precision, Recall, Macro F1, confusion matrices, and RAG Answer Relevance / Hallucination metrics.

---

## 13. Benchmark Strategy

All performance, scalability, and productivity claims will be verified using reproducible, automated execution scripts outputting structured JSON metrics:

1. **API Benchmark (`npm run benchmark:api`):** Latency p50, p95, p99 across email listing, search, and detail routes.
2. **Search Benchmark (`npm run benchmark:search`):** Query latency and throughput across Elasticsearch full-text and Qdrant vector queries.
3. **IMAP Benchmark (`npm run benchmark:imap`):** Message parsing throughput and ingestion latency per 1,000 emails.
4. **AI & RAG Benchmark (`npm run benchmark:ai`, `npm run benchmark:rag`):** Inference latency, token consumption rates, error rates, and context retrieval recall.
5. **Load Benchmark (`npm run benchmark:load`):** k6 load test simulating concurrent users, active WebSocket connections, and high-frequency queue job processing.
6. **Productivity Impact Benchmark (`npm run benchmark:productivity`):** Empirical trial comparing baseline manual categorization time vs. AI-assisted categorization time on a benchmark email dataset.
