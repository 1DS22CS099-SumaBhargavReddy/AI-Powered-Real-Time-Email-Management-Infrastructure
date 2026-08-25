import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export type AICategory =
  | 'INTERESTED'
  | 'MEETING_BOOKED'
  | 'NOT_INTERESTED'
  | 'SPAM'
  | 'OUT_OF_OFFICE'
  | 'UNCATEGORIZED';

export interface StructuredClassificationResult {
  category: AICategory;
  confidence: number;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'high' | 'medium' | 'low';
  reasoning: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokenCount: number;
}

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-1.5-flash';
  private promptVersion = 'v2.0-gemini-structured';

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    } else {
      logger.warn('⚠️ GEMINI_API_KEY is not set. AIService running with heuristic rules fallback.');
    }
  }

  /**
   * Categorize an email using Google Gemini structured output
   */
  async categorizeEmail(subject: string, bodyText: string): Promise<StructuredClassificationResult> {
    const startTime = Date.now();

    const systemPrompt = `You are a high-accuracy AI Email Classifier for sales and business operations.
Analyze the given email subject and body, and output ONLY a valid JSON object following this exact schema:

{
  "category": "INTERESTED" | "MEETING_BOOKED" | "NOT_INTERESTED" | "SPAM" | "OUT_OF_OFFICE" | "UNCATEGORIZED",
  "confidence": number between 0.0 and 1.0,
  "summary": "1-2 sentence key summary of the email",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "high" | "medium" | "low",
  "reasoning": "brief explanation for category choice"
}

Category Definitions:
- INTERESTED: Lead expressed interest in product, service, pricing, demo, or next steps.
- MEETING_BOOKED: Lead confirmed/scheduled a call, calendar invite, or meeting time.
- NOT_INTERESTED: Lead declined, asked to be removed, unsubscribed, or stated no budget/need.
- SPAM: Unsolicited commercial junk, phishing, scam, or automated newsletter.
- OUT_OF_OFFICE: Automatic responder, out of office vacation reply, or auto-reply notification.
- UNCATEGORIZED: General transaction, receipt, internal note, or ambiguous message.

Subject: ${subject}
Body: ${bodyText.substring(0, 2000)}`;

    if (!this.genAI) {
      return this.heuristicFallback(subject, bodyText, startTime, 'No Gemini API key');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const result = await model.generateContent(systemPrompt);
      const latencyMs = Date.now() - startTime;
      const text = result.response.text();

      const parsed = JSON.parse(text);
      const validCategories: AICategory[] = [
        'INTERESTED', 'MEETING_BOOKED', 'NOT_INTERESTED', 'SPAM', 'OUT_OF_OFFICE', 'UNCATEGORIZED'
      ];

      const category: AICategory = validCategories.includes(parsed.category)
        ? parsed.category
        : 'UNCATEGORIZED';

      const tokenCount = result.response.usageMetadata?.totalTokenCount || 0;

      return {
        category,
        confidence: Math.min(Math.max(parsed.confidence || 0.8, 0.0), 1.0),
        summary: parsed.summary || 'Summary unavailable',
        sentiment: parsed.sentiment || 'neutral',
        urgency: parsed.urgency || 'medium',
        reasoning: parsed.reasoning || 'Categorized by Gemini AI',
        model: this.modelName,
        promptVersion: this.promptVersion,
        latencyMs,
        tokenCount
      };
    } catch (err: any) {
      logger.error(`[Gemini AI Error] Categorization failed: ${err.message}`);
      return this.heuristicFallback(subject, bodyText, startTime, err.message);
    }
  }

  /**
   * Generate 768-dim text embedding using Gemini embedding model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.genAI) {
      return this.deterministicMockEmbedding(text);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text.substring(0, 2048));
      return result.embedding.values;
    } catch (err: any) {
      logger.error(`[Gemini Embedding Error] ${err.message}`);
      return this.deterministicMockEmbedding(text);
    }
  }

  /**
   * Grounded AI reply generation
   */
  async generateReplies(
    subject: string,
    body: string,
    contextChunks: string[] = []
  ): Promise<{ professional: string; friendly: string; short: string; isRagGrounded: boolean }> {
    const contextText = contextChunks.length > 0
      ? `RELEVANT CONTEXT EXAMPLES:\n${contextChunks.join('\n---\n')}\n\n`
      : '';

    const prompt = `You are an AI Email Assistant. Generate 3 response suggestions for this email.
${contextText}Original Subject: ${subject}
Original Body: ${body}

Output strictly valid JSON with keys: "professional", "friendly", "short".
Format:
{
  "professional": "Formal, professional reply...",
  "friendly": "Warm, conversational reply...",
  "short": "Concise 1-sentence reply..."
}`;

    if (!this.genAI) {
      return {
        professional: `Thank you for your email regarding "${subject}". I have received your message and will follow up shortly.`,
        friendly: `Hi! Thanks for reaching out about "${subject}". I'll check on this and get back to you soon!`,
        short: `Thanks for the update on "${subject}". Will follow up shortly.`,
        isRagGrounded: contextChunks.length > 0
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
      });

      const res = await model.generateContent(prompt);
      const parsed = JSON.parse(res.response.text());

      return {
        professional: parsed.professional || '',
        friendly: parsed.friendly || '',
        short: parsed.short || '',
        isRagGrounded: contextChunks.length > 0
      };
    } catch (err: any) {
      logger.error(`[Gemini Reply Error] ${err.message}`);
      return {
        professional: `Thank you for your email regarding "${subject}". I have received your message and will follow up shortly.`,
        friendly: `Hi! Thanks for reaching out about "${subject}". I'll check on this and get back to you soon!`,
        short: `Thanks for the update on "${subject}". Will follow up shortly.`,
        isRagGrounded: false
      };
    }
  }

  /**
   * Summarize email text
   */
  async summarizeEmail(subject: string, bodyText: string): Promise<string> {
    const prompt = `Summarize this email into 2-3 key points.
Subject: ${subject}
Body: ${bodyText.substring(0, 2000)}`;

    if (!this.genAI) {
      return `Key Points:\n* Email received regarding: ${subject}\n* Action Required: Read full message body.`;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const res = await model.generateContent(prompt);
      return res.response.text().trim();
    } catch (err: any) {
      logger.error(`[Gemini Summarize Error] ${err.message}`);
      return `Key Points:\n* Email received regarding: ${subject}\n* Action Required: Follow up with sender.`;
    }
  }

  private heuristicFallback(
    subject: string,
    bodyText: string,
    startTime: number,
    reason: string
  ): StructuredClassificationResult {
    const text = `${subject} ${bodyText}`.toLowerCase();
    let category: AICategory = 'UNCATEGORIZED';
    let summary = `Fallback classification: ${subject}`;
    let confidence = 0.75;

    if (text.includes('meeting') || text.includes('confirmed') || text.includes('scheduled') || text.includes('meet') || text.includes('invite')) {
      category = 'MEETING_BOOKED';
      confidence = 0.85;
      summary = `Key Points:\n* Meeting confirmation/invite received for: ${subject}`;
    } else if (text.includes('demo') || text.includes('pricing') || text.includes('quote') || text.includes('trial') || text.includes('interested') || text.includes('purchase')) {
      category = 'INTERESTED';
      confidence = 0.85;
      summary = `Key Points:\n* High interest in product/demo: ${subject}`;
    } else if (text.includes('crypto') || text.includes('payout') || text.includes('btc') || text.includes('wallet') || text.includes('loan') || text.includes('backlinks') || text.includes('claim')) {
      category = 'SPAM';
      confidence = 0.90;
      summary = `Key Points:\n* Flagged as promotional/spam: ${subject}`;
    } else if (text.includes('out of office') || text.includes('auto-reply') || text.includes('annual leave') || text.includes('maternity leave')) {
      category = 'OUT_OF_OFFICE';
      confidence = 0.90;
      summary = `Key Points:\n* Sender is currently out of office`;
    } else if (text.includes('unsubscribe') || text.includes('not interested') || text.includes('remove') || text.includes('pass on')) {
      category = 'NOT_INTERESTED';
      confidence = 0.85;
      summary = `Key Points:\n* Prospect indicated no interest or requested removal`;
    }

    return {
      category,
      confidence,
      summary,
      sentiment: 'neutral',
      urgency: 'medium',
      reasoning: `Heuristic rule applied (${reason})`,
      model: 'heuristic-rules-v1',
      promptVersion: 'fallback',
      latencyMs: Date.now() - startTime,
      tokenCount: 0
    };
  }

  private deterministicMockEmbedding(text: string): number[] {
    const vector = new Array(768).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % 768] = (vector[i % 768] + charCode / 255.0) % 1.0;
    }
    return vector;
  }
}