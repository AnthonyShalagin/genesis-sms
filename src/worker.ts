import "dotenv/config";
import { GmailService } from "./services/gmail";
import { processMessage } from "./services/commander";

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "30000", 10);

async function main() {
  console.log("[Worker] Genesis SMS Worker starting...");
  console.log(`[Worker] Polling interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`[Worker] Gmail: ${process.env.GMAIL_ADDRESS}`);
  console.log(`[Worker] SMS Gateway: ${process.env.SMS_GATEWAY}`);

  const gmail = new GmailService();

  // Graceful shutdown
  let running = true;
  process.on("SIGINT", () => {
    console.log("\n[Worker] Shutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    console.log("\n[Worker] Shutting down...");
    running = false;
  });

  console.log("[Worker] Ready. Waiting for commands...\n");

  while (running) {
    try {
      const messages = await gmail.fetchUnreadMessages();

      if (messages.length > 0) {
        console.log(`[Worker] Found ${messages.length} new message(s)`);
      }

      for (const msg of messages) {
        await processMessage(msg, gmail);
      }
    } catch (err) {
      console.error("[Worker] Poll error:", err);
    }

    // Wait for next poll
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, POLL_INTERVAL);
      if (!running) {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  console.log("[Worker] Stopped.");
  process.exit(0);
}

main();
