import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeCommand, VehicleCommand } from "@/services/genesis";
import { GmailService } from "@/services/gmail";

const VALID_COMMANDS: VehicleCommand[] = [
  "start",
  "stop",
  "lock",
  "unlock",
  "status",
];
const MAX_COMMANDS_PER_DAY = 10;

export async function POST(request: NextRequest) {
  // Authenticate with API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { command?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const command = body.command?.toLowerCase() as VehicleCommand;
  const pin = body.pin || "";

  if (!command || !VALID_COMMANDS.includes(command)) {
    return NextResponse.json(
      { error: `Invalid command. Use: ${VALID_COMMANDS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate PIN
  if (pin !== process.env.COMMAND_PIN) {
    await prisma.commandLog.create({
      data: {
        command,
        sender: "api",
        pin: "***",
        status: "rejected",
        error: "Invalid PIN",
      },
    });
    return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
  }

  // Rate limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await prisma.commandLog.count({
    where: { status: "success", createdAt: { gte: today } },
  });
  if (count >= MAX_COMMANDS_PER_DAY) {
    return NextResponse.json(
      { error: "Daily limit reached (10/day)" },
      { status: 429 }
    );
  }

  // Execute
  const log = await prisma.commandLog.create({
    data: { command, sender: "api", pin: "***", status: "pending" },
  });

  const result = await executeCommand(command);

  await prisma.commandLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? "success" : "failed",
      response: result.message,
      error: result.success ? null : result.message,
    },
  });

  // Send SMS confirmation if gateway is configured
  if (process.env.SMS_GATEWAY && process.env.GMAIL_APP_PASSWORD) {
    try {
      const gmail = new GmailService();
      await gmail.sendSms(result.message);
    } catch {
      // SMS confirmation is best-effort
    }
  }

  const status = result.success ? 200 : 502;
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status }
  );
}
