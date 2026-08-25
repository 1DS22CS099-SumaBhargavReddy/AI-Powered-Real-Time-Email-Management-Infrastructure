import { ImapFlow } from 'imapflow';
import { prisma } from '../../config/prisma';
import { decryptPassword } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import { emailParseQueue } from '../../queues/queue.manager';
import { SyncStatus } from '@prisma/client';

interface ActiveDaemon {
  accountId: string;
  client: ImapFlow;
  status: SyncStatus;
  reconnectAttempts: number;
  stopped: boolean;
}

export class ImapDaemonManager {
  private static instance: ImapDaemonManager;
  private daemons: Map<string, ActiveDaemon> = new Map();

  public static getInstance(): ImapDaemonManager {
    if (!ImapDaemonManager.instance) {
      ImapDaemonManager.instance = new ImapDaemonManager();
    }
    return ImapDaemonManager.instance;
  }

  /**
   * Start IMAP IDLE daemon for an account
   */
  public async startAccountDaemon(accountId: string): Promise<void> {
    if (this.daemons.has(accountId)) {
      const active = this.daemons.get(accountId)!;
      if (active.status === SyncStatus.CONNECTED || active.status === SyncStatus.IDLE) {
        logger.info(`[IMAP Daemon] Account ${accountId} daemon is already active.`);
        return;
      }
    }

    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      logger.error(`[IMAP Daemon] Account ${accountId} not found in DB.`);
      return;
    }

    await this.updateAccountStatus(accountId, SyncStatus.CONNECTING);

    const decryptedPassword = decryptPassword(account.encryptedPassword);
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: true,
      auth: {
        user: account.email,
        pass: decryptedPassword
      },
      logger: false,
      tls: { rejectUnauthorized: false }
    });

    const daemonState: ActiveDaemon = {
      accountId,
      client,
      status: SyncStatus.CONNECTING,
      reconnectAttempts: 0,
      stopped: false
    };

    this.daemons.set(accountId, daemonState);

    this.setupListeners(daemonState, account);
    await this.connectAndIdle(daemonState, account);
  }

  private async connectAndIdle(daemon: ActiveDaemon, account: any): Promise<void> {
    try {
      logger.info(`[IMAP Daemon] Connecting to ${account.imapHost}:${account.imapPort} for ${account.email}`);
      await daemon.client.connect();

      daemon.status = SyncStatus.CONNECTED;
      daemon.reconnectAttempts = 0;
      await this.updateAccountStatus(daemon.accountId, SyncStatus.CONNECTED);

      // Perform Initial / Incremental Sync for INBOX
      await this.syncMailbox(daemon, account, 'INBOX');

      // Enter IDLE state
      await this.enterIdle(daemon, account, 'INBOX');
    } catch (err: any) {
      logger.error(`[IMAP Daemon] Connection error for ${account.email}: ${err.message}`);
      await this.handleReconnect(daemon, account);
    }
  }

  private async enterIdle(daemon: ActiveDaemon, account: any, mailboxPath: string): Promise<void> {
    if (daemon.stopped) return;

    try {
      logger.info(`[IMAP Daemon] Entering IDLE mode on ${mailboxPath} for ${account.email}`);
      const lock = await daemon.client.getMailboxLock(mailboxPath);
      
      daemon.status = SyncStatus.IDLE;
      await this.updateAccountStatus(daemon.accountId, SyncStatus.IDLE);

      try {
        // Wait on IDLE loop
        await daemon.client.idle();
      } finally {
        lock.release();
      }
    } catch (err: any) {
      logger.warn(`[IMAP Daemon] IDLE interrupted for ${account.email}: ${err.message}`);
      if (!daemon.stopped) {
        await this.handleReconnect(daemon, account);
      }
    }
  }

  public async syncMailbox(daemon: ActiveDaemon, account: any, mailboxPath: string): Promise<void> {
    try {
      await this.updateAccountStatus(daemon.accountId, SyncStatus.SYNCING);
      logger.info(`[IMAP Sync] Syncing ${mailboxPath} for ${account.email}...`);

      const lock = await daemon.client.getMailboxLock(mailboxPath);
      try {
        const mailboxStatus = await daemon.client.status(mailboxPath, { messages: true, uidNext: true, uidValidity: true });
        const totalMessages = mailboxStatus.messages || 0;

        if (totalMessages > 0) {
          // Sync last 30 messages or incremental delta
          const fetchCount = 30;
          const startSeq = Math.max(1, totalMessages - fetchCount + 1);
          const endSeq = totalMessages;

          for await (const message of daemon.client.fetch(`${startSeq}:${endSeq}`, { source: true, envelope: true, uid: true })) {
            if (!message.source) continue;

            // Enqueue to emailParseQueue for async background worker processing
            await emailParseQueue.add('parse-email', {
              userId: account.userId,
              accountId: account.id,
              mailboxPath,
              uid: message.uid,
              rawMime: message.source.toString('utf-8')
            }, {
              jobId: `imap-${account.id}-${mailboxPath}-${message.uid}` // Idempotent Job ID
            });
          }
        }

        await prisma.emailAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date() }
        });
      } finally {
        lock.release();
      }
    } catch (err: any) {
      logger.error(`[IMAP Sync] Failed to sync ${mailboxPath} for ${account.email}: ${err.message}`);
    }
  }

  private setupListeners(daemon: ActiveDaemon, account: any): void {
    daemon.client.on('exists', async (data) => {
      logger.info(`[IMAP Notification] New message alert on ${account.email}. Count: ${data.count}`);
      // Perform incremental sync
      this.syncMailbox(daemon, account, 'INBOX').catch((e) => logger.error(`Sync failure: ${e.message}`));
    });

    daemon.client.on('error', (err) => {
      logger.error({ err }, `[IMAP Socket Error] ${account.email}`);
    });

    daemon.client.on('close', async () => {
      logger.warn(`[IMAP Socket Closed] ${account.email}`);
      if (!daemon.stopped) {
        await this.handleReconnect(daemon, account);
      }
    });
  }

  private async handleReconnect(daemon: ActiveDaemon, account: any): Promise<void> {
    if (daemon.stopped) return;

    daemon.reconnectAttempts += 1;
    daemon.status = SyncStatus.RECONNECTING;
    await this.updateAccountStatus(daemon.accountId, SyncStatus.RECONNECTING);

    // Exponential backoff with jitter: 2^attempt * 1000ms + random jitter up to 1000ms
    const backoffMs = Math.min(Math.pow(2, daemon.reconnectAttempts) * 1000 + Math.random() * 1000, 60000);
    logger.info(`[IMAP Reconnect] Reconnecting ${account.email} in ${(backoffMs / 1000).toFixed(1)}s (Attempt #${daemon.reconnectAttempts})`);

    setTimeout(() => {
      this.connectAndIdle(daemon, account).catch((err) => logger.error(`Reconnect fail: ${err.message}`));
    }, backoffMs);
  }

  public async stopAccountDaemon(accountId: string): Promise<void> {
    const daemon = this.daemons.get(accountId);
    if (daemon) {
      daemon.stopped = true;
      daemon.status = SyncStatus.STOPPED;
      try {
        await daemon.client.logout();
      } catch (e) {
        // Ignore logout errors during force stop
      }
      this.daemons.delete(accountId);
      await this.updateAccountStatus(accountId, SyncStatus.STOPPED);
      logger.info(`[IMAP Daemon] Stopped daemon for account ${accountId}`);
    }
  }

  public getAccountStatus(accountId: string): SyncStatus | undefined {
    return this.daemons.get(accountId)?.status;
  }

  public getAllAccountStatuses(): Array<{ accountId: string; status: SyncStatus }> {
    return Array.from(this.daemons.entries()).map(([accountId, d]) => ({
      accountId,
      status: d.status
    }));
  }

  private async updateAccountStatus(accountId: string, status: SyncStatus): Promise<void> {
    try {
      await prisma.emailAccount.update({
        where: { id: accountId },
        data: { syncStatus: status }
      });
    } catch (e: any) {
      logger.error(`Failed to update account status: ${e.message}`);
    }
  }
}

export const imapDaemonManager = ImapDaemonManager.getInstance();
