# ADR-003: Elasticsearch 8.x Full-Text Search Engine

## Status
Accepted

## Context
Relational `ILIKE` queries in PostgreSQL lack relevance ranking, token stemming, and snippet highlighting across multi-million email rows.

## Decision
We integrate Elasticsearch 8.x with custom analyzers, tokenizers, highlighting, category filtering, and `search_after` pagination.

## Consequences
- **Pros:** Sub-25ms full-text search across Millions of emails, search highlighting, multi-field relevance boosting.
- **Cons:** Secondary index sync latency (~50ms after ingestion).
