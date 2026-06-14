// @ts-nocheck
/**
 * WRead Email Module — "Send to WRead" Feature
 * Provides email sending (SMTP) and receiving (IMAP) capabilities for the
 * "Send to WRead" feature. This replaces the original Cloudflare Workers +
 * Supabase approach with local SMTP/IMAP.
 *
 * IMPORTANT: This module MUST only be imported from server-side code (API routes,
 * middleware, server components). It uses Node.js-only modules (nodemailer, tls,
 * net) that cannot run in the browser.
 *
 * For the client bundle, next.config.mjs aliases this module to wread-email-stub.ts,
 * so these imports are never executed in the browser.
 */

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const SMTP_HOST = process.env['WREAD_SMTP_HOST'] || '';
const SMTP_PORT = parseInt(process.env['WREAD_SMTP_PORT'] || '587', 10);
const SMTP_SECURE = process.env['WREAD_SMTP_SECURE'] === 'true';
const SMTP_USER = process.env['WREAD_SMTP_USER'] || '';
const SMTP_PASS = process.env['WREAD_SMTP_PASS'] || '';
const SMTP_FROM = process.env['WREAD_SMTP_FROM_ADDRESS'] || 'noreply@wread.local';

const IMAP_HOST = process.env['WREAD_IMAP_HOST'] || '';
const IMAP_PORT = parseInt(process.env['WREAD_IMAP_PORT'] || '993', 10);
const IMAP_SECURE = process.env['WREAD_IMAP_SECURE'] !== 'false'; // default true
const IMAP_USER = process.env['WREAD_IMAP_USER'] || '';
const IMAP_PASS = process.env['WREAD_IMAP_PASS'] || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InboxEmail {
  from: string;
  to: string;
  subject: string;
  date: Date;
  attachments: { filename: string; contentType: string; data: Buffer }[];
}

// ---------------------------------------------------------------------------
// SMTP – Sending
// ---------------------------------------------------------------------------

let _nodemailer: any = null;

/**
 * Lazily load nodemailer. We use dynamic require so the module is only pulled
 * in when email is actually used (and only on the server). If nodemailer is
 * not installed we fail gracefully.
 */
function getNodemailer(): any | null {
  if (_nodemailer !== null) return _nodemailer;
  const isServer = typeof window === 'undefined' && typeof process !== 'undefined';
  if (!isServer) return null;
  try {
    _nodemailer = require('nodemailer');
    return _nodemailer;
  } catch {
    console.warn('[WRead Email] nodemailer is not installed. Email sending will not work. Install it with: pnpm add nodemailer');
    _nodemailer = false;
    return null;
  }
}

/** Check if email (SMTP) is configured and available */
export function isEmailConfigured(): boolean {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;
  return getNodemailer() !== null && getNodemailer() !== false;
}

/** Send an email via SMTP */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('[WRead Email] Cannot send email — SMTP is not configured.');
    return false;
  }

  const nodemailer = getNodemailer();
  if (!nodemailer) {
    console.warn('[WRead Email] Cannot send email — nodemailer is not available.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const result = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html: htmlBody,
      text: textBody || undefined,
    });

    console.log(`[WRead Email] Email sent to "${to}" — subject: "${subject}" — messageId: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error('[WRead Email] Failed to send email:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// IMAP – Receiving (polling)
// ---------------------------------------------------------------------------

/**
 * We use the `imapflow` library for IMAP because it provides a modern,
 * promise-based API that is much simpler to use than raw socket IMAP.
 * If `imapflow` is not installed we fall back to a no-op implementation.
 */
let _imapflow: any = null;

function getImapFlow(): any | null {
  if (_imapflow !== null) return _imapflow;
  const isServer = typeof window === 'undefined' && typeof process !== 'undefined';
  if (!isServer) return null;
  try {
    _imapflow = require('imapflow');
    return _imapflow;
  } catch {
    console.warn('[WRead Email] imapflow is not installed. IMAP polling will not work. Install it with: pnpm add imapflow');
    _imapflow = false;
    return null;
  }
}

/** Check if IMAP is configured for receiving */
export function isIMAPConfigured(): boolean {
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) return false;
  return getImapFlow() !== null && getImapFlow() !== false;
}

/**
 * Poll IMAP inbox for new emails addressed to a specific user's send address.
 *
 * The `userAddress` parameter is the full email address that was assigned to a
 * user for the "Send to WRead" feature (e.g. `user-abc@wread.local`).
 *
 * This function:
 * 1. Connects to the IMAP server
 * 2. Searches for UNSEEN messages in INBOX addressed to `userAddress`
 * 3. Fetches the messages including attachments
 * 4. Marks the messages as SEEN so they are not re-fetched
 * 5. Returns the parsed emails
 */
export async function pollInbox(userAddress: string): Promise<InboxEmail[]> {
  if (!isIMAPConfigured()) {
    return [];
  }

  const ImapFlow = getImapFlow();
  if (!ImapFlow) return [];

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: {
      user: IMAP_USER,
      pass: IMAP_PASS,
    },
    logger: false as any, // disable verbose imapflow logging
  });

  const emails: InboxEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for unseen messages addressed to the user
      const searchCriteria = {
        unseen: true,
        to: userAddress,
      };

      const messageIds = await client.search(searchCriteria);

      if (messageIds.length === 0) {
        return [];
      }

      console.log(`[WRead Email] Found ${messageIds.length} new message(s) for "${userAddress}"`);

      // Fetch each message
      for (const uid of messageIds) {
        try {
          const message = await client.fetchOne(uid, {
            envelope: true,
            source: true,
            bodyStructure: true,
          }, { uid: true });

          // Parse the raw email source to extract attachments
          const parsed = await parseRawEmail(message.source);

          emails.push({
            from: message.envelope.from?.[0]?.address || message.envelope.from?.[0]?.name || 'unknown',
            to: userAddress,
            subject: message.envelope.subject || '(no subject)',
            date: new Date(message.envelope.date || Date.now()),
            attachments: parsed.attachments,
          });

          // Mark as seen so we don't re-fetch
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } catch (msgErr) {
          console.error(`[WRead Email] Error fetching message uid=${uid}:`, msgErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error) {
    console.error('[WRead Email] IMAP polling error:', error);
    // Try to logout cleanly on error
    try { await client.logout(); } catch { /* ignore */ }
  }

  return emails;
}

// ---------------------------------------------------------------------------
// Raw email parsing (lightweight — no external deps)
// ---------------------------------------------------------------------------

/**
 * Very lightweight email parser that extracts attachments from a raw RFC822
 * email source Buffer. This avoids pulling in a heavy library like `mailparser`
 * for the common case of just needing attachments.
 *
 * If `mailparser` is available it will be used instead for better reliability.
 */
async function parseRawEmail(
  source: Buffer,
): Promise<{ attachments: { filename: string; contentType: string; data: Buffer }[] }> {
  // Try mailparser first
  try {
    const { simpleParser } = require('mailparser');
    const parsed = await simpleParser(source);
    const attachments = (parsed.attachments || []).map((att: any) => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType || 'application/octet-stream',
      data: att.content,
    }));
    return { attachments };
  } catch {
    // mailparser not available, fall through to manual parsing
  }

  // Fallback: minimal manual MIME parsing
  const attachments: { filename: string; contentType: string; data: Buffer }[] = [];
  try {
    const text = source.toString('binary');
    const boundaryMatch = text.match(/boundary="?([^"\r\n;]+)"?/i);
    if (!boundaryMatch) return { attachments };

    const boundary = boundaryMatch[1];
    const parts = text.split('--' + boundary);

    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headers = part.substring(0, headerEnd);
      const contentDisposition = headers.match(/Content-Disposition:\s*attachment(?:;\s*filename="?([^"\r\n;]+)"?)?/i);

      if (contentDisposition) {
        const filename = contentDisposition[1] || 'unnamed';
        const contentTypeMatch = headers.match(/Content-Type:\s*([^;\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

        // Find encoding
        const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i);
        const encoding = encodingMatch ? encodingMatch[1].toLowerCase().trim() : '7bit';

        let bodyStart = headerEnd + 4;
        let bodyEnd = part.length;
        // Trim trailing CRLF before boundary
        if (part.endsWith('\r\n')) bodyEnd -= 2;

        const bodyText = part.substring(bodyStart, bodyEnd);
        let data: Buffer;

        if (encoding === 'base64') {
          data = Buffer.from(bodyText.replace(/[\r\n]/g, ''), 'base64');
        } else {
          data = Buffer.from(bodyText, 'binary');
        }

        attachments.push({ filename, contentType, data });
      }
    }
  } catch (err) {
    console.warn('[WRead Email] Manual MIME parsing failed:', err);
  }

  return { attachments };
}

// ---------------------------------------------------------------------------
// IMAP Polling Lifecycle
// ---------------------------------------------------------------------------

let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _pollingRunning = false;

/** Default polling interval in milliseconds (5 minutes) */
const DEFAULT_POLL_INTERVAL = 5 * 60 * 1000;

/**
 * Callback registry — consumers can register to be notified when new emails
 * arrive for specific user addresses.
 */
const _emailCallbacks: Map<string, Array<(emails: InboxEmail[]) => void>> = new Map();

/**
 * Register a callback for when emails arrive for a specific user address.
 * Returns an unsubscribe function.
 */
export function onEmailReceived(
  userAddress: string,
  callback: (emails: InboxEmail[]) => void,
): () => void {
  if (!_emailCallbacks.has(userAddress)) {
    _emailCallbacks.set(userAddress, []);
  }
  _emailCallbacks.get(userAddress)!.push(callback);

  return () => {
    const callbacks = _emailCallbacks.get(userAddress);
    if (callbacks) {
      const idx = callbacks.indexOf(callback);
      if (idx !== -1) callbacks.splice(idx, 1);
      if (callbacks.length === 0) _emailCallbacks.delete(userAddress);
    }
  };
}

/**
 * Perform a single poll across all registered user addresses.
 */
async function _performPoll(): Promise<void> {
  if (_pollingRunning) return; // prevent overlapping polls
  _pollingRunning = true;

  try {
    const addresses = Array.from(_emailCallbacks.keys());
    if (addresses.length === 0) return;

    for (const address of addresses) {
      try {
        const emails = await pollInbox(address);
        if (emails.length > 0) {
          const callbacks = _emailCallbacks.get(address) || [];
          for (const cb of callbacks) {
            try {
              cb(emails);
            } catch (cbErr) {
              console.error(`[WRead Email] Callback error for ${address}:`, cbErr);
            }
          }
        }
      } catch (err) {
        console.error(`[WRead Email] Polling error for ${address}:`, err);
      }
    }
  } finally {
    _pollingRunning = false;
  }
}

/**
 * Start the IMAP polling interval. Called once at server startup.
 * @param intervalMs Polling interval in milliseconds (default: 5 minutes)
 */
export function startEmailPolling(intervalMs: number = DEFAULT_POLL_INTERVAL): void {
  if (!isIMAPConfigured()) {
    console.log('[WRead Email] IMAP not configured — email polling disabled.');
    return;
  }

  if (_pollInterval) {
    console.log('[WRead Email] Polling already started.');
    return;
  }

  console.log(`[WRead Email] Starting IMAP polling every ${intervalMs / 1000}s`);
  _pollInterval = setInterval(_performPoll, intervalMs);

  // Also perform an initial poll after a short delay
  setTimeout(_performPoll, 3000);
}

/** Stop email polling */
export function stopEmailPolling(): void {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
    console.log('[WRead Email] Email polling stopped.');
  }
}

// ---------------------------------------------------------------------------
// Convenience: Send a "Send to WRead" confirmation email
// ---------------------------------------------------------------------------

/**
 * Send a confirmation email to the user after they've configured their
 * "Send to WRead" email address.
 */
export async function sendSendToWReadConfirmation(
  userEmail: string,
  sendAddress: string,
): Promise<boolean> {
  const subject = 'WRead — Send to WRead Configured';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">Send to WRead is Ready!</h2>
      <p>Your dedicated send address is:</p>
      <p style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 16px;">
        ${sendAddress}
      </p>
      <p>Forward emails with ebook attachments to this address and they will appear in your WRead library automatically.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #888; font-size: 12px;">WRead — Self-hosted reading platform</p>
    </div>
  `;
  const text = `Send to WRead is Ready!\n\nYour dedicated send address is: ${sendAddress}\n\nForward emails with ebook attachments to this address and they will appear in your WRead library automatically.`;

  return sendEmail(userEmail, subject, html, text);
}
