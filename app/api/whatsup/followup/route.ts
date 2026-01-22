import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FollowUpRequest {
  question: string;
  context: {
    bullets: Array<{
      main: string;
      subPoints?: Array<{ text: string; sourceUrl?: string }>;
    }>;
    conclusion?: string;
    sentiment: string;
  };
  conversationHistory?: FollowUpMessage[];
  bulletIndex?: number; // If user clicked a specific bullet
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body: FollowUpRequest = await request.json();
    const { question, context, conversationHistory = [], bulletIndex } = body;

    if (!question || !context) {
      return NextResponse.json(
        { error: "Missing required fields: question and context" },
        { status: 400 }
      );
    }

    // Build context summary for the AI
    const bulletsSummary = context.bullets
      .map((b, i) => `${i + 1}. ${b.main}${b.subPoints ? '\n   ' + b.subPoints.map(sp => `→ ${sp.text}`).join('\n   ') : ''}`)
      .join('\n');

    const contextSummary = `MARKET ANALYSIS CONTEXT:
${bulletsSummary}

CONCLUSION: ${context.conclusion || 'Not provided'}
SENTIMENT: ${context.sentiment}`;

    // If user clicked on a specific bullet, highlight it
    const bulletContext = bulletIndex !== undefined
      ? `\n\nThe user is specifically asking about bullet point #${bulletIndex + 1}: "${context.bullets[bulletIndex]?.main}"`
      : '';

    const systemPrompt = `You are a helpful crypto market analyst assistant. The user has just received a market analysis and wants to follow up with questions.

Your job is to:
1. Answer their questions based on the market analysis context provided
2. Elaborate on specific points when asked
3. Explain concepts or terminology they don't understand
4. Provide additional context or analysis when helpful

CRITICAL FORMATTING RULES:
- Write in simple, flowing prose
- NEVER use markdown formatting like **bold headers**, bullet points, or numbered lists
- NEVER use section headers like "**The Trigger**" or "**Why It Matters**"
- When making multiple distinct points, separate them with a blank line for readability
- Each paragraph should cover one main idea
- Keep paragraphs short (2-3 sentences each) for easy reading
- Write conversationally, like explaining to a friend

Keep responses helpful but concise. If asked about something not in the original analysis, you can provide general crypto knowledge but note that it wasn't part of the original report.

Be direct and helpful. Don't be overly formal.`;

    const userPrompt = `${contextSummary}${bulletContext}

USER QUESTION: ${question}`;

    // Build messages array with conversation history
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: userPrompt,
      },
    ];

    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Claude API error: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error("Invalid response from Claude API");
    }

    return NextResponse.json({
      answer: data.content[0].text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in follow-up:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up response" },
      { status: 500 }
    );
  }
}
