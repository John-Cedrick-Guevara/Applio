import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { EmailMessage } from '../../core/apply/send-application';
import { AppError } from '../../shared/errors';

/** Gmail refused or couldn't be reached. The message is for the operator and never holds the password. */
/** `code`: `email_auth` for a rejected address or app password, `email_offline` when Gmail can't be reached. */
export class EmailError extends AppError {
  constructor(message: string, options?: ErrorOptions & { code?: 'email_auth' | 'email_offline' }) {
    super(options?.code ?? 'email_failed', message, options);
  }
}

/** The part of a nodemailer transport this adapter uses, so tests can capture messages. */
export interface MailTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
  /** Signs in to SMTP without sending; nodemailer's transports have it. */
  verify?(): Promise<unknown>;
}

interface Options {
  user: string;
  /** The Gmail app password, from the keychain; used only for SMTP auth. */
  pass: string;
  transport?: (auth: { user: string; pass: string }) => MailTransport;
}

const gmailSmtp = (auth: { user: string; pass: string }): MailTransport =>
  nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth });

/** Turns nodemailer's failures into a next step; the original stays as the cause for the logs. */
const readable = (err: unknown) => {
  const code = (err as { code?: unknown }).code;
  const message = err instanceof Error ? err.message : String(err);
  if (code === 'EAUTH') return new EmailError('Gmail rejected the address or app password. Create an app password at myaccount.google.com/apppasswords and save it in Settings.', { cause: err, code: 'email_auth' });
  if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'EDNS') return new EmailError("Couldn't reach Gmail. Check the connection and try again.", { cause: err, code: 'email_offline' });
  return new EmailError(`Gmail refused the email: ${message}`, { cause: err });
};

/**
 * Sends from the operator's Gmail over SMTP with an app password (SPEC §2,
 * F5 channel 1). Plain text, attachments read from the job folder.
 */
export function createGmail({ user, pass, transport = gmailSmtp }: Options) {
  const smtp = transport({ user, pass });
  const send = async (message: SendMailOptions) => {
    try {
      await smtp.sendMail(message);
    } catch (err) {
      throw readable(err);
    }
  };
  return {
    send: (m: EmailMessage) =>
      send({
        from: m.from, to: m.to, subject: m.subject, text: m.text, attachments: m.attachments,
        ...(m.messageId ? { messageId: m.messageId } : {}),
        ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: m.references ?? m.inReplyTo } : {}),
      }),
    /** Signs in to Gmail's SMTP without sending, so saved credentials are known to work. @throws EmailError */
    verify: async () => {
      try {
        await smtp.verify?.();
      } catch (err) {
        throw readable(err);
      }
    },
    /** Settings' "Send test email": a short note to the operator's own address. */
    sendTest: () => send({ from: user, to: user, subject: 'Applio test email', text: 'Applio can send from this Gmail account.' }),
  };
}
