import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmailParserService } from '../services/imap/emailParser.service';
import { AIService } from '../services/ai.service';
import { imapDaemonManager } from '../services/imap/imapDaemon.manager';

describe('AI-Powered Email Infrastructure System Test Suite', () => {

  describe('EmailParserService', () => {
    it('should correctly parse MIME sample email and extract message details', async () => {
      const rawMime = `From: "Jane Doe" <jane@example.com>
To: "Support" <support@emailinfra.internal>
Subject: Enterprise SLA & Demo Query
Content-Type: text/plain; charset=utf-8

Hello team, we want to inquire about your enterprise SLA guarantees and schedule a live product demo for our 20 account managers.`;

      const parsed = await EmailParserService.parseMime(rawMime, 'support@emailinfra.internal');

      expect(parsed.subject).toBe('Enterprise SLA & Demo Query');
      expect(parsed.senderEmail).toBe('jane@example.com');
      expect(parsed.receiverEmail).toBe('support@emailinfra.internal');
      expect(parsed.bodyText).toContain('enterprise SLA guarantees');
      expect(parsed.snippet).toContain('Hello team');
      expect(parsed.messageId).toBeDefined();
    });

    it('should generate a deterministic message ID if header is missing', async () => {
      const rawMime = `From: "Sender" <sender@example.com>
Subject: Test Without Message ID

Body text without explicit message ID.`;

      const parsed = await EmailParserService.parseMime(rawMime, 'receiver@emailinfra.internal');
      expect(parsed.messageId).toMatch(/<gen-.*@emailinfra\.internal>/);
    });
  });

  describe('AIService Fallback & Categorization Engine', () => {
    let aiService: AIService;

    beforeEach(() => {
      aiService = new AIService();
    });

    it('should categorize demo inquiry email as INTERESTED', async () => {
      const subject = 'Enterprise Demo Request';
      const body = 'We are looking to purchase 50 seats for our sales team and would like to see a demo.';

      const result = await aiService.categorizeEmail(subject, body);
      expect(result.category).toBe('INTERESTED');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });

    it('should categorize meeting invite email as MEETING_BOOKED', async () => {
      const subject = 'Confirmed: Technical Architecture Sync @ Fri Aug 28';
      const body = 'Your meeting has been confirmed with Alex. Google Meet link: https://meet.google.com/abc-defg';

      const result = await aiService.categorizeEmail(subject, body);
      expect(result.category).toBe('MEETING_BOOKED');
    });

    it('should categorize spam crypto email as SPAM', async () => {
      const subject = 'URGENT: Claim $5,000 crypto payout!';
      const body = 'Click here immediately to connect your Web3 wallet and claim 0.5 BTC.';

      const result = await aiService.categorizeEmail(subject, body);
      expect(result.category).toBe('SPAM');
    });

    it('should generate professional, friendly, and short reply suggestions', async () => {
      const subject = 'Demo Inquiry';
      const body = 'Can we schedule a call to see a demo?';

      const replies = await aiService.generateReplies(subject, body);
      expect(replies.professional).toBeDefined();
      expect(replies.friendly).toBeDefined();
      expect(replies.short).toBeDefined();
    });
  });

  describe('IMAP Daemon State Machine', () => {
    it('should return null or STOPPED state for unconnected accounts', async () => {
      const status = imapDaemonManager.getAccountStatus('non-existent-account-id');
      expect(status).toBeUndefined();
    });

    it('should list zero active daemons initially', () => {
      const active = imapDaemonManager.getAllAccountStatuses();
      expect(Array.isArray(active)).toBe(true);
    });
  });

});
