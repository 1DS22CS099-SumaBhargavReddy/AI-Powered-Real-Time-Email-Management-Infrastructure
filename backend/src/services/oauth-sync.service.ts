import { EmailPipeline } from '../workflows/emailPipeline';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { decryptPassword } from '../utils/crypto';

export class OAuthSyncService {
  /**
   * Sync emails for a connected account via IMAP
   */
  static async syncAccount(
    userId: string,
    accountId: string,
    websocketService?: any
  ): Promise<void> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        logger.error(`[IMAP Sync] EmailAccount ${accountId} not found.`);
        return;
      }

      logger.info(`[IMAP Sync] Starting IMAP sync for user ${userId} (${account.email})`);

      let emailsToProcess: Array<{
        messageId: string;
        sender: string;
        receiver: string;
        subject: string;
        body: string;
        receivedAt: Date;
      }> = [];

      try {
        const decryptedPassword = decryptPassword(account.encryptedPassword);
        emailsToProcess = await this.fetchImapEmails(
          account.email,
          decryptedPassword,
          account.imapHost,
          account.imapPort
        );
      } catch (err: any) {
        logger.error(`[IMAP Sync] IMAP fetch failed: ${err.message}. Please check credentials.`);
        return;
      }

      logger.info(`[IMAP Sync] Fetched ${emailsToProcess.length} emails to process for user ${userId}`);

      for (const email of emailsToProcess) {
        try {
          const persisted = await EmailPipeline.processEmail({
            userId,
            accountId,
            sender: email.sender,
            receiver: email.receiver,
            subject: email.subject,
            bodyText: email.body,
            receivedAt: email.receivedAt,
            messageId: email.messageId
          });

          if (persisted && websocketService) {
            websocketService.sendToUser(userId, 'newEmailSync', persisted);
          }
        } catch (pipelineErr: any) {
          logger.error(`[IMAP Sync] Failed processing email ${email.messageId}: ${pipelineErr.message}`);
        }
      }

      logger.info(`[IMAP Sync] Successfully synced account: ${account.id}`);
    } catch (error: any) {
      logger.error(`[IMAP Sync] Sync fatal error: ${error.message}`);
    }
  }

  private static async fetchImapEmails(user: string, pass: string, host: string, port: number) {
    const client = new ImapFlow({
      host: host,
      port: port,
      secure: true,
      auth: { user: user, pass: pass },
      logger: false,
      tls: { rejectUnauthorized: false }
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    const emails = [];
    try {
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        const startSeq = Math.max(1, totalMessages - 14);
        const endSeq = totalMessages;

        for await (const message of client.fetch(`${startSeq}:${endSeq}`, { source: true, envelope: true })) {
          if (!message.source) continue;
          try {
            const parsed = await simpleParser(message.source);
            emails.push({
              messageId: parsed.messageId || `${host}-${message.uid}`,
              sender: (parsed.from as any)?.text || 'Unknown',
              receiver: (parsed.to as any)?.text || user,
              subject: parsed.subject || '(No Subject)',
              body: parsed.text || (parsed.html as string) || '(No Body)',
              receivedAt: parsed.date || new Date()
            });
          } catch (err: any) {
            logger.warn(`[IMAP] Failed to parse message UID ${message.uid}: ${err.message}`);
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return emails.reverse();
  }
}
