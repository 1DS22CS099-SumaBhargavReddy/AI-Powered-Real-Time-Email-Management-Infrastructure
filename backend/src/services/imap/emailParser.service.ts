import { simpleParser, ParsedMail, AddressObject } from 'mailparser';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface ParsedEmailData {
  messageId: string;
  sender: string;
  senderEmail: string;
  receiver: string;
  receiverEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  snippet: string;
  recipients: Array<{ type: 'TO' | 'CC' | 'BCC'; name: string; address: string }>;
  attachments: Array<{ filename: string; contentType: string; size: number; contentId?: string }>;
  date: Date;
}

export class EmailParserService {
  /**
   * Parse raw MIME buffer into structured data
   */
  static async parseMime(buffer: Buffer | string, fallbackUser: string): Promise<ParsedEmailData> {
    const parsed: ParsedMail = await simpleParser(buffer);

    const senderObj = this.getFirstAddress(parsed.from);
    const receiverObj = this.getFirstAddress(parsed.to);

    const bodyText = parsed.text || this.stripHtml(parsed.html || '') || 'No text content';
    const bodyHtml = typeof parsed.html === 'string' ? parsed.html : '';
    const snippet = bodyText.substring(0, 150).replace(/\s+/g, ' ').trim();

    // Deterministic Message ID
    let messageId = parsed.messageId;
    if (!messageId || messageId.trim() === '') {
      const hash = crypto.createHash('sha256')
        .update(`${senderObj.address}-${parsed.subject}-${parsed.date?.getTime()}`)
        .digest('hex');
      messageId = `<gen-${hash}@emailinfra.internal>`;
    }

    const recipients: Array<{ type: 'TO' | 'CC' | 'BCC'; name: string; address: string }> = [];
    
    this.extractRecipients(parsed.to, 'TO', recipients);
    this.extractRecipients(parsed.cc, 'CC', recipients);
    this.extractRecipients(parsed.bcc, 'BCC', recipients);

    const attachments = (parsed.attachments || []).map((att) => ({
      filename: att.filename || 'unnamed_attachment',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      contentId: att.contentId
    }));

    return {
      messageId: messageId.trim(),
      sender: senderObj.name || senderObj.address || 'Unknown Sender',
      senderEmail: senderObj.address || 'unknown@domain.com',
      receiver: receiverObj.name || receiverObj.address || fallbackUser,
      receiverEmail: receiverObj.address || fallbackUser,
      subject: parsed.subject || '(No Subject)',
      bodyText,
      bodyHtml,
      snippet,
      recipients,
      attachments,
      date: parsed.date || new Date()
    };
  }

  private static getFirstAddress(addrObj: AddressObject | AddressObject[] | undefined): { name: string; address: string } {
    if (!addrObj) return { name: '', address: '' };
    if (Array.isArray(addrObj)) {
      return this.getFirstAddress(addrObj[0]);
    }
    if (addrObj.value && addrObj.value.length > 0) {
      const first = addrObj.value[0];
      return { name: first.name || '', address: first.address || '' };
    }
    return { name: '', address: '' };
  }

  private static extractRecipients(
    addrObj: AddressObject | AddressObject[] | undefined,
    type: 'TO' | 'CC' | 'BCC',
    out: Array<{ type: 'TO' | 'CC' | 'BCC'; name: string; address: string }>
  ) {
    if (!addrObj) return;
    const list = Array.isArray(addrObj) ? addrObj : [addrObj];
    for (const item of list) {
      if (item.value) {
        for (const addr of item.value) {
          if (addr.address) {
            out.push({
              type,
              name: addr.name || '',
              address: addr.address
            });
          }
        }
      }
    }
  }

  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '');
  }
}
