import { NextResponse } from "next/server";
import { generateWhatsUp } from "@/lib/openai";

export async function GET() {
  try {
    const data = await generateWhatsUp();

    return NextResponse.json({
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating WhatsUp:", error);
    return NextResponse.json(
      { error: "Failed to generate market summary" },
      { status: 500 }
    );
  }
}
