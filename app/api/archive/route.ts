import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/^(\d{1,2})([a-z]{3})(\d{2})/i);
  if (!match) return null;
  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const year = 2000 + parseInt(match[3]);
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[monthStr];
  if (month === undefined) return null;
  return new Date(year, month, day);
}

function formatDateLabel(date: Date): string {
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export async function GET() {
  try {
    const samplesDir = path.join(process.cwd(), "samples");
    const files = await fs.readdir(samplesDir);

    // Group files by date prefix
    const groups: Record<string, { txt?: string; images: string[] }> = {};

    for (const file of files) {
      const match = file.match(/^(\d{1,2}[a-z]{3}\d{2})/i);
      if (!match) continue;
      const prefix = match[1].toLowerCase();

      if (!groups[prefix]) {
        groups[prefix] = { images: [] };
      }

      if (file.endsWith(".txt")) {
        groups[prefix].txt = file;
      } else if (file.endsWith(".png")) {
        groups[prefix].images.push(file);
      }
    }

    // Build entries with content
    const entries = await Promise.all(
      Object.entries(groups)
        .filter(([, group]) => group.txt)
        .map(async ([prefix, group]) => {
          const content = await fs.readFile(
            path.join(samplesDir, group.txt!),
            "utf-8"
          );
          const date = parseDateFromFilename(prefix);
          const dateLabel = date ? formatDateLabel(date) : prefix;
          // Sort images naturally (1.png before 2.png)
          const images = group.images.sort();

          return {
            date: prefix,
            dateLabel,
            content,
            images,
            _sortDate: date?.getTime() ?? 0,
          };
        })
    );

    // Sort newest first
    entries.sort((a, b) => b._sortDate - a._sortDate);

    // Strip internal sort field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = entries.map(({ _sortDate, ...rest }) => rest);

    return NextResponse.json({ entries: result });
  } catch (error) {
    console.error("Archive API error:", error);
    return NextResponse.json(
      { error: "Failed to load archive" },
      { status: 500 }
    );
  }
}
