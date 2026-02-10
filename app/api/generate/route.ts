import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/claude";
import { CoinData } from "@/lib/coingecko";
import { promises as fs } from "fs";
import path from "path";

function parseDateFromFilename(filename: string): Date | null {
  // Match pattern: 15jan26.txt, 5jan26.txt, 4dec25.txt
  const match = filename.match(/^(\d{1,2})([a-z]{3})(\d{2})\.txt$/i);
  if (!match) return null;

  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const year = 2000 + parseInt(match[3]); // 26 -> 2026

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

    // Sort by date, newest first
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

    // Most recent is now first in the sorted array
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prices } = body as { prices: CoinData[] };

    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json(
        { error: "Price data is required" },
        { status: 400 }
      );
    }

    // Load sample reports for style reference
    const { samples, mostRecent } = await loadSampleReports();

    // Generate the report using Claude
    const report = await generateReport(prices, samples, mostRecent);

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error generating report:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
