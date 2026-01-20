import { BotContext } from "../bot";
import { generateReport } from "@/lib/claude";
import { fetchSpecificCoins } from "@/lib/coingecko";
import {
  formatReportMessage,
  formatLoadingMessage,
  formatErrorMessage,
} from "../formatters";
import { promises as fs } from "fs";
import path from "path";

function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/^(\d{1,2})([a-z]{3})(\d{2})\.txt$/i);
  if (!match) return null;

  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const year = 2000 + parseInt(match[3]);

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const month = months[monthStr];
  if (month === undefined) return null;

  return new Date(year, month, day);
}

async function loadSampleReports(): Promise<{ samples: string[]; mostRecent: string }> {
  const samplesDir = path.join(process.cwd(), "samples");

  try {
    const files = await fs.readdir(samplesDir);
    const txtFiles = files.filter((f) => f.endsWith(".txt"));

    txtFiles.sort((a, b) => {
      const dateA = parseDateFromFilename(a);
      const dateB = parseDateFromFilename(b);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    const samples = await Promise.all(
      txtFiles.map(async (file) => {
        const content = await fs.readFile(path.join(samplesDir, file), "utf-8");
        return content.trim();
      })
    );

    const validSamples = samples.filter((s) => s.length > 0);
    const mostRecentFile = txtFiles[0];
    let mostRecent = "";

    if (mostRecentFile) {
      mostRecent = await fs.readFile(path.join(samplesDir, mostRecentFile), "utf-8");
      mostRecent = mostRecent.trim();
    }

    return {
      samples: validSamples,
      mostRecent: mostRecent || validSamples[0] || "",
    };
  } catch {
    console.log("No sample reports found, generating without style reference");
    return { samples: [], mostRecent: "" };
  }
}

export async function handleReport(ctx: BotContext): Promise<void> {
  // Check if password is required
  const reportPassword = process.env.REPORT_PASSWORD;

  if (reportPassword) {
    ctx.session.awaitingPassword = true;
    await ctx.reply(
      "🔐 Enter the password to generate the weekly report:",
      { parse_mode: "HTML" }
    );
  } else {
    // No password required, generate directly
    await generateAndSendReport(ctx);
  }
}

export async function handleReportPassword(ctx: BotContext): Promise<void> {
  const password = ctx.message?.text;
  const correctPassword = process.env.REPORT_PASSWORD;

  // Reset password state
  ctx.session.awaitingPassword = false;

  if (!password) {
    await ctx.reply(formatErrorMessage("No password provided"), {
      parse_mode: "HTML",
    });
    return;
  }

  if (password !== correctPassword) {
    await ctx.reply(formatErrorMessage("Incorrect password"), {
      parse_mode: "HTML",
    });
    return;
  }

  // Password correct, generate report
  await generateAndSendReport(ctx);
}

async function generateAndSendReport(ctx: BotContext): Promise<void> {
  const loadingMsg = await ctx.reply(
    formatLoadingMessage("Generating weekly report"),
    { parse_mode: "HTML" }
  );

  try {
    // Fetch price data
    const defaultIds = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];
    const coins = await fetchSpecificCoins(defaultIds);

    // Load sample reports
    const { samples, mostRecent } = await loadSampleReports();

    // Generate the report
    const report = await generateReport(coins, samples, mostRecent);

    // Edit the loading message with the result
    // Telegram has a 4096 character limit for messages
    const formattedReport = formatReportMessage(report);

    if (formattedReport.length <= 4096) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMsg.message_id,
        formattedReport,
        { parse_mode: "HTML" }
      );
    } else {
      // Delete loading message and send report in chunks
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

      // Split into chunks at paragraph boundaries
      const chunks: string[] = [];
      let currentChunk = "";
      const paragraphs = formattedReport.split("\n\n");

      for (const para of paragraphs) {
        if ((currentChunk + "\n\n" + para).length > 4000) {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = para;
        } else {
          currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      }
    }
  } catch (error) {
    console.error("Error generating report:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate report";

    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMsg.message_id,
      formatErrorMessage(errorMessage),
      { parse_mode: "HTML" }
    );
  }
}
