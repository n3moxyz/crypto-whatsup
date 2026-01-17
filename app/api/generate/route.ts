import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/claude";
import { CoinData } from "@/lib/coingecko";
import { promises as fs } from "fs";
import path from "path";

async function loadSampleReports(): Promise<{ samples: string[]; mostRecent: string }> {
  const samplesDir = path.join(process.cwd(), "samples");

  try {
    const files = await fs.readdir(samplesDir);
    const txtFiles = files.filter((f) => f.endsWith(".txt"));

    // Sort files by name to get most recent (assuming date-based naming)
    // Files like 5jan26.txt, 4dec25.txt, etc.
    txtFiles.sort((a, b) => {
      // Extract date info for sorting - most recent first
      // This is a simple sort that puts newer dates first based on filename
      return b.localeCompare(a);
    });

    const samples = await Promise.all(
      txtFiles.map(async (file) => {
        const content = await fs.readFile(path.join(samplesDir, file), "utf-8");
        return content.trim();
      })
    );

    const validSamples = samples.filter((s) => s.length > 0);

    // Most recent report is the first one (5jan26.txt based on our naming)
    // Find the file that starts with "5jan26" specifically as it's the most recent
    const mostRecentFile = txtFiles.find(f => f.includes("5jan26")) || txtFiles[0];
    let mostRecent = "";

    if (mostRecentFile) {
      mostRecent = await fs.readFile(path.join(samplesDir, mostRecentFile), "utf-8");
      mostRecent = mostRecent.trim();
    }

    return {
      samples: validSamples,
      mostRecent: mostRecent || validSamples[0] || "",
    };
  } catch (error) {
    console.log("No sample reports found, generating without style reference");
    return { samples: [], mostRecent: "" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prices: CoinData[] = body.prices;

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
