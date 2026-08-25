# ADR-005: Deterministic Message Identity & IMAP Idempotency

## Status
Accepted

## Context
IMAP UIDs are mailbox-specific and can reset when `UIDVALIDITY` changes. Relying solely on raw UIDs caused duplicate email ingestion and missing records.

## Decision
We enforce a deterministic email identity strategy using `userId + messageId` and `accountId + mailboxId + UID` composite unique keys in PostgreSQL, with fallback SHA-256 header hashing if standard `Message-ID` header is missing.

## Consequences
- **Pros:** 100% idempotent message processing, zero duplicate writes during network reconnects or job retries.
- **Cons:** Slightly higher hash computation per message.
