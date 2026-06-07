import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { streamText } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Configure Bedrock with AWS credentials
  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  const systemPrompt = `You are s-slide, an AI presentation design expert. You help users create professional PowerPoint presentations.

When a user asks for a presentation, briefly describe what you'll create and let them know the slides are being generated. Keep your response short: 2-3 sentences max. The actual PPTX file is generated automatically alongside your response.

Example: "Creating a 6-slide presentation on ${'${topic}'} with a fire opener, claim-proof structure, and closing call-to-action. Your download will be ready shortly."

Do NOT output slide-by-slide breakdowns or tables. Just a quick summary of the approach. Be concise and friendly.`;

  const result = streamText({
    model: bedrock("global.anthropic.claude-sonnet-4-6"),
    system: systemPrompt,
    messages
  });

  return result.toTextStreamResponse();
}
