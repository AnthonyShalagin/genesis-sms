import { prisma } from "@/lib/prisma";
import { GmailService, IncomingMessage } from "./gmail";
import { executeCommand, VehicleCommand } from "./genesis";

const VALID_COMMANDS: VehicleCommand[] = [
  "start",
  "stop",
  "lock",
  "unlock",
  "status",
];
const MAX_COMMANDS_PER_DAY = 10;

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

async function isWithinRateLimit(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.commandLog.count({
    where: {
      status: "success",
      createdAt: { gte: today },
    },
  });

  return count < MAX_COMMANDS_PER_DAY;
}

export async function processMessage(
  message: IncomingMessage,
  gmail: GmailService
): Promise<void> {
  console.log(
    `[Commander] Processing message from ${message.from}: "${message.body.substring(0, 50)}"`
  );

  // Parse command from message body
  const parsed = parseMessage(message.body);

  if (!parsed) {
    console.log("[Commander] Invalid command format, ignoring");
    await prisma.commandLog.create({
      data: {
        command: message.body.substring(0, 50),
        sender: message.from,
        status: "rejected",
        error: "Invalid command format",
      },
    });
    return;
  }

  // Validate sender
  if (!isAllowedSender(message.from)) {
    console.log(`[Commander] Unauthorized sender: ${message.from}`);
    await prisma.commandLog.create({
      data: {
        command: parsed.command,
        sender: message.from,
        pin: "***",
        status: "rejected",
        error: "Unauthorized sender",
      },
    });
    return;
  }

  // Validate PIN
  if (!isValidPin(parsed.pin)) {
    console.log("[Commander] Invalid PIN");
    await prisma.commandLog.create({
      data: {
        command: parsed.command,
        sender: message.from,
        pin: "***",
        status: "rejected",
        error: "Invalid PIN",
      },
    });
    await gmail.sendSms("Command rejected: invalid PIN");
    return;
  }

  // Check rate limit
  if (!(await isWithinRateLimit())) {
    console.log("[Commander] Rate limit exceeded");
    await prisma.commandLog.create({
      data: {
        command: parsed.command,
        sender: message.from,
        pin: "***",
        status: "rejected",
        error: "Daily rate limit exceeded",
      },
    });
    await gmail.sendSms("Command rejected: daily limit reached (10/day)");
    return;
  }

  // Execute command
  const log = await prisma.commandLog.create({
    data: {
      command: parsed.command,
      sender: message.from,
      pin: "***",
      status: "pending",
    },
  });

  const result = await executeCommand(parsed.command);

  await prisma.commandLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? "success" : "failed",
      response: result.message,
      error: result.success ? null : result.message,
    },
  });

  // Send confirmation SMS
  await gmail.sendSms(result.message);
  console.log(`[Commander] ${parsed.command} → ${result.message}`);
}
