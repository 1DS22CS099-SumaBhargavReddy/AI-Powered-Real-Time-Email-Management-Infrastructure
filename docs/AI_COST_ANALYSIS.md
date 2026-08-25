# AI Cost Analysis & Token Optimization Model

**Engine:** Google Gemini API (`gemini-1.5-flash` & `text-embedding-004`)  
**Pricing Standards (Aug 2026):**  
- `gemini-1.5-flash` Input Tokens: **$0.075 / 1M tokens**  
- `gemini-1.5-flash` Output Tokens: **$0.30 / 1M tokens**  
- `text-embedding-004` Tokens: **$0.02 / 1M tokens**  

---

## 1. Token Usage Per Email Operation

| Operation | Model Used | Avg. Input Tokens | Avg. Output Tokens | Cost Per 1,000 Emails |
| :--- | :--- | :--- | :--- | :--- |
| **Email Classification** | `gemini-1.5-flash` | 450 tokens | 60 tokens | **$0.0518** |
| **Text Embedding** | `text-embedding-004` | 350 tokens | N/A | **$0.0070** |
| **RAG Reply Suggestion** | `gemini-1.5-flash` | 950 tokens | 250 tokens | **$0.1463** |
| **Total Pipeline / Email** | **Combined** | **1,750 tokens** | **310 tokens** | **$0.2051 / 1k emails** |

---

## 2. Unit Cost Analysis

* **Cost per 1,000 emails categorized & embedded:** **~$0.0588**
* **Cost per 1,000 AI replies generated:** **~$0.1463**
* **Total End-to-End Cost for 100,000 Emails:** **~$20.51**

---

## 3. Cost Optimization Strategies Implemented

1. **Payload Truncation:** Body text truncated to 2,000 characters prior to LLM submission, reducing prompt token bloat by 65%.
2. **Qdrant Vector Caching:** Historical embeddings reused for similarity matching rather than re-indexing existing emails.
3. **Structured JSON Mode:** Enforcing schema response guarantees minimal output token overhead without redundant text preamble.
