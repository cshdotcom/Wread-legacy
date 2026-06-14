/**
 * WRead Email Client Stub
 * This stub is used by the client-side webpack bundle to prevent
 * Node.js-only modules (nodemailer, imapflow, mailparser, net, tls) from
 * being included. The real implementation is only used on the server side.
 *
 * next.config.mjs aliases wread-email to this file when bundling for the browser.
 */

export interface InboxEmail {
  from: string;
  to: string;
  subject: string;
  date: Date;
  attachments: { filename: string; contentType: string; data: Buffer }[];
}

/** Check if email (SMTP) is configured and available */
export function isEmailConfigured(): boolean {
  return false;
}

/** Send an email via SMTP */
export async function sendEmail(
  _to: string,
  _subject: string,
  _htmlBody: string,
  _textBody?: string,
): Promise<boolean> {
  return false;
}

/** Check if IMAP is configured for receiving */
export function isIMAPConfigured(): boolean {
  return false;
}

/** Poll IMAP inbox for new emails addressed to a specific user's send address */
export async function pollInbox(_userAddress: string): Promise<InboxEmail[]> {
  return [];
}

/** Start the IMAP polling interval (called once at server startup) */
export function startEmailPolling(_intervalMs?: number): void {
  return;
}

/** Stop email polling */
export function stopEmailPolling(): void {
  return;
}

/** Register a callback for when emails arrive (no-op on client) */
export function onEmailReceived(
  _userAddress: string,
  _callback: (emails: InboxEmail[]) => void,
): () => void {
  return () => {};
}

/** Send a "Send to WRead" confirmation email */
export async function sendSendToWReadConfirmation(
  _userEmail: string,
  _sendAddress: string,
): Promise<boolean> {
  return false;
}
