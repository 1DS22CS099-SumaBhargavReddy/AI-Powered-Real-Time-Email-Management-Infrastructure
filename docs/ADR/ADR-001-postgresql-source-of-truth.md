# ADR-001: PostgreSQL as Durable Primary Source of Truth

## Status
Accepted

## Context
The initial prototype relied heavily on Elasticsearch and ChromaDB in-memory objects to track email state, causing data loss risks when search containers restarted or when schema updates were required.

## Decision
We adopt PostgreSQL as the single, durable primary source of truth for all system entities (`User`, `EmailAccount`, `Mailbox`, `Email`, `EmailRecipient`, `EmailAttachment`, `AIClassification`, `AIReply`, `AuditLog`). Elasticsearch and Qdrant serve strictly as derived secondary indexes.

## Consequences
- **Pros:** Strong ACID transactions, foreign key cascading, unambiguous schema migrations via Prisma, data durability.
- **Cons:** Requires sync workers to keep PostgreSQL, Elasticsearch, and Qdrant in sync.
