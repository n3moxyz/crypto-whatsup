/**
 * Telegram Webhook Setup Script
 *
 * Run this script after deploying to set up the Telegram webhook.
 *
 * Usage:
 *   npx tsx scripts/setup-webhook.ts
 *
 * Required environment variables:
 *   TELEGRAM_BOT_TOKEN - Your bot token from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET - Random secret for webhook verification
 *
 * Optional:
 *   WEBHOOK_URL - Full webhook URL (defaults to prompting)
 */

async function setupWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN environment variable is required");
    console.log("\nTo get a bot token:");
    console.log("1. Open Telegram and message @BotFather");
    console.log("2. Send /newbot and follow the prompts");
    console.log("3. Copy the token and set it as TELEGRAM_BOT_TOKEN");
    process.exit(1);
  }

  // Get webhook URL from env or prompt
  let webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    // Default to common Vercel URL pattern
    console.log("\nEnter your webhook URL (e.g., https://your-app.vercel.app/api/telegram):");
    console.log("Or set WEBHOOK_URL environment variable before running this script.\n");

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    webhookUrl = await new Promise<string>((resolve) => {
      rl.question("Webhook URL: ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!webhookUrl) {
    console.error("Error: Webhook URL is required");
    process.exit(1);
  }

  // Ensure URL ends with /api/telegram
  if (!webhookUrl.endsWith("/api/telegram")) {
    if (webhookUrl.endsWith("/")) {
      webhookUrl += "api/telegram";
    } else {
      webhookUrl += "/api/telegram";
    }
  }

  console.log(`\nSetting webhook to: ${webhookUrl}`);

  // Build the setWebhook URL
  const telegramApiUrl = `https://api.telegram.org/bot${token}/setWebhook`;

  const params: Record<string, string> = {
    url: webhookUrl,
  };

  // Add secret token if configured
  if (secret) {
    params.secret_token = secret;
    console.log("Using webhook secret for verification");
  } else {
    console.log("Warning: No TELEGRAM_WEBHOOK_SECRET set. Webhook will be unprotected.");
  }

  try {
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (result.ok) {
      console.log("\n✅ Webhook set successfully!");
      console.log(`\nBot is now listening at: ${webhookUrl}`);
      console.log("\nTest your bot by sending /start in Telegram.");
    } else {
      console.error("\n❌ Failed to set webhook:");
      console.error(result.description || JSON.stringify(result));
      process.exit(1);
    }

    // Get webhook info
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );
    const info = await infoResponse.json();

    if (info.ok) {
      console.log("\n📋 Webhook Info:");
      console.log(`   URL: ${info.result.url}`);
      console.log(`   Has custom certificate: ${info.result.has_custom_certificate}`);
      console.log(`   Pending update count: ${info.result.pending_update_count}`);
      if (info.result.last_error_message) {
        console.log(`   Last error: ${info.result.last_error_message}`);
      }
    }
  } catch (error) {
    console.error("\n❌ Error setting webhook:", error);
    process.exit(1);
  }
}

// Set bot commands
async function setBotCommands() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const commands = [
    { command: "start", description: "Welcome message and menu" },
    { command: "whatsup", description: "Market summary with analysis" },
    { command: "prices", description: "Current crypto prices" },
    { command: "report", description: "Generate weekly report (admin)" },
  ];

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands }),
      }
    );

    const result = await response.json();
    if (result.ok) {
      console.log("\n✅ Bot commands registered successfully!");
    }
  } catch (error) {
    console.error("Failed to set bot commands:", error);
  }
}

async function main() {
  console.log("🤖 Telegram Webhook Setup\n");

  await setupWebhook();
  await setBotCommands();

  console.log("\n🎉 Setup complete!");
}

main();
