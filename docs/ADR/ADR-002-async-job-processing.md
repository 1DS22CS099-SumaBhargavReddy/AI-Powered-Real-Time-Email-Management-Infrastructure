# ADR-002: Asynchronous Job Processing via Redis & BullMQ

## Status
Accepted

## Context
Executing IMAP sync, Google Gemini AI calls, and vector embeddings synchronously within Express REST request loops caused thread blocking and 30-second HTTP gateway timeouts.

## Decision
We decouple all heavy processing into background BullMQ queues (`email-sync`, `email-parse`, `email-classify`, `email-embed`, `reply-generation`) powered by Redis 7.

## Consequences
- **Pros:** Express REST handlers return in sub-15ms, retries with exponential backoff and dead-letter queues prevent lost jobs, horizontal scalability of worker threads.
- **Cons:** Requires Redis operational overhead.
