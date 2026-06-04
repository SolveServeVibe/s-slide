import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { executePptxGenJSCode, generatePresentationCode, parsePresentationRequest } from "@/lib/agent-tools";
import { randomUUID } from "crypto";
import { z } from "zod";

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
2. Call the generate_slide tool with appropriate parameters
3. Provide a friendly response about what you're creating
4. Help them download the result

Be friendly, concise, and helpful. Focus on delivering working presentations quickly.`;

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    system: systemPrompt,
    messages,
    tools: {
      generate_slide: {
        description: "Generate PowerPoint presentation code using PptxGenJS library",
        parameters: z.object({
          topic: z.string().describe("The main topic of the presentation"),
          slideCount: z.number().describe("Number of slides to generate"),
          slideContent: z.string().optional().describe("Detailed content for each slide (optional)")
        }),
        execute: async ({ topic, slideCount, slideContent }) => {
          const code = generatePresentationCode(topic, slideCount, slideContent);

          try {
            const pptxBuffer = await executePptxGenJSCode(code);

            const fs = require("fs");
            const path = require("path");
            const uuid = randomUUID();
            const filename = `presentation-${uuid}.pptx`;
            const publicDir = path.join(process.cwd(), "public", "presentations");

            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }

            const filepath = path.join(publicDir, filename);
            fs.writeFileSync(filepath, pptxBuffer);

            return {
              success: true,
              pptxUrl: `/presentations/${filename}`,
              filename,
              slideCount
            };
          } catch (error) {
            console.error("Presentation generation error:", error);
            return {
              success: false,
              error: error instanceof Error ? error.message : "Failed to generate presentation"
            };
          }
        }
      }
    },
    maxSteps: 5
  });

  return result.toAIStreamResponse();
}

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
2. Call the generate_slide tool with appropriate parameters
3. Provide a friendly response about what you're creating
4. Help them download the result

Be friendly, concise, and helpful. Focus on delivering working presentations quickly.`;

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    system: systemPrompt,
    messages,
    tools: {
      generate_slide: generateSlideTool
    },
    maxSteps: 5
  });

  return result.toAIStreamResponse();
}
