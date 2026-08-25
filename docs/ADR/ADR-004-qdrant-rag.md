# ADR-004: Qdrant Vector DB for Grounded RAG Replies

## Status
Accepted

## Context
Generative AI reply suggestions without historical context risk hallucination or generic boilerplate responses.

## Decision
We store 768-dim Gemini embeddings (`text-embedding-004`) in Qdrant Vector DB with `userId` and `accountId` payload filters, retrieving top-K relevant thread context prior to invoking Gemini response generation.

## Consequences
- **Pros:** Grounded AI replies, context relevance, elimination of generic responses.
- **Cons:** Additional vector embedding step per ingested email.
