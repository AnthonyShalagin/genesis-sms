import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface IncomingMessage {
  uid: number;
  from: string;
  subject: string;
  body: string;
  date: Date;
}

export class GmailService {
  private gmailAddress: string;
  private gmailAppPassword: string;
  private smsGateway: string;

  constructor() {
    this.gmailAddress = process.env.GMAIL_ADDRESS!;
    this.gmailAppPassword = process.env.GMAIL_APP_PASSWORD!;
    this.smsGateway = process.env.SMS_GATEWAY!;
  }

  async fetchUnreadMessages(): Promise<IncomingMessage[]> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: this.gmailAddress,
        pass: this.gmailAppPassword,
      },
      logger: false,
    });

    const messages: IncomingMessage[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Search for unread messages
        const searchResult = await client.search({ seen: false });

        if (!searchResult || (Array.isArray(searchResult) && searchResult.length === 0)) {
          return messages;
        }

        const uids = Array.isArray(searchResult) ? searchResult : [searchResult];

        for await (const msg of client.fetch(uids, {
          uid: true,
          envelope: true,
          source: true,
        })) {
          const envelope = msg.envelope;
          if (!envelope) continue;
          const from = envelope.from?.[0]?.address || "";
          const subject = envelope.subject || "";

          // Extract plain text body from the raw source
          const rawSource = msg.source?.toString() || "";
          const body = extractPlainText(rawSource);

          messages.push({
            uid: msg.uid,
            from,
            subject,
            body: body || subject, // Fall back to subject if body is empty
            date: envelope.date || new Date(),
          });

          // Mark as read
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], {
            uid: true,
          });
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      console.error("[Gmail] IMAP error:", err);
      try {
        await client.logout();
      } catch {
        // ignore logout errors
      }
    }

    return messages;
  }

  async sendSms(text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: this.gmailAddress,
        pass: this.gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: this.gmailAddress,
      to: this.smsGateway,
      subject: "",
      text,
    });

    console.log("[Gmail] SMS sent:", text);
  }
}

function extractPlainText(rawEmail: string): string {
  // Simple extraction: find the body after the headers (double newline)
  const headerBodySplit = rawEmail.indexOf("\r\n\r\n");
  if (headerBodySplit === -1) return "";

  let body = rawEmail.slice(headerBodySplit + 4);

  // If multipart, try to find the plain text part
  const contentTypeMatch = rawEmail.match(/Content-Type:\s*([^\r\n;]+)/i);
  const contentType = contentTypeMatch?.[1]?.trim() || "";

  if (contentType.startsWith("multipart/")) {
    const boundaryMatch = rawEmail.match(/boundary="?([^"\r\n;]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(`--${boundary}`);
      for (const part of parts) {
        if (part.toLowerCase().includes("content-type: text/plain")) {
          const partBody = part.split("\r\n\r\n").slice(1).join("\r\n\r\n");
          return partBody.replace(/--$/, "").trim();
        }
      }
    }
  }

  // Single-part message — return body directly
  return body.trim();
}
