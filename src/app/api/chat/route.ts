import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `You are s-slide, an AI presentation assistant that helps users create beautiful PowerPoint presentations.

Your capabilities:
- Create professional presentations using PptxGenJS
- Generate slides with proper formatting, colors, and layout
- Use purple/lavender color schemes as the primary theme
- Handle user requests for presentations on any topic

When a user asks for a presentation:
1. Extract the topic and number of slides they want
2. Provide a friendly response about what you're creating
3. Generate the presentation using PptxGenJS

Be friendly, concise, and helpful. Focus on delivering working presentations quickly.

For now, respond with text about what presentation you would create. The actual PowerPoint generation will be added soon.`;

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    system: systemPrompt,
    messages
  });

  return result.toTextStreamResponse();
}
