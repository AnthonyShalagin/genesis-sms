import { GmailService, IncomingMessage } from "./gmail";
import { executeCommand, VehicleCommand } from "./genesis";

const VALID_COMMANDS: VehicleCommand[] = [
  "start",
  "stop",
  "lock",
  "unlock",
  "status",
];

interface ParsedCommand {
  command: VehicleCommand;
  pin: string;
}

function parseMessage(text: string): ParsedCommand | null {
  // Expected format: "COMMAND PIN" e.g. "START 1249"
  const cleaned = text.trim().toUpperCase();
  const parts = cleaned.split(/\s+/);

  if (parts.length < 2) return null;

  const command = parts[0].toLowerCase() as VehicleCommand;
  const pin = parts[1];

  if (!VALID_COMMANDS.includes(command)) return null;

  return { command, pin };
}

function isAllowedSender(sender: string): boolean {
  const allowed = process.env.ALLOWED_SENDER;
  if (!allowed) return false;
  return sender.toLowerCase() === allowed.toLowerCase();
}

function isValidPin(pin: string): boolean {
  return pin === process.env.COMMAND_PIN;
}

export async function processMessage(
  message: IncomingMessage,
  gmail: GmailService
): Promise<void> {
  console.log(
    `[Commander] Processing message from ${message.from}: "${message.body.substring(0, 50)}"`
  );

  const parsed = parseMessage(message.body);

  if (!parsed) {
    console.log("[Commander] Invalid command format, ignoring");
    return;
  }

  if (!isAllowedSender(message.from)) {
    console.log(`[Commander] Unauthorized sender: ${message.from}`);
    return;
  }

  if (!isValidPin(parsed.pin)) {
    console.log("[Commander] Invalid PIN");
    await gmail.sendSms("Command rejected: invalid PIN");
    return;
  }

  // Execute command
  const result = await executeCommand(parsed.command);
  await gmail.sendSms(result.message);
  console.log(`[Commander] ${parsed.command} → ${result.message}`);
}
