import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText, tool } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { message } = await req.json();

  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  const publicDir = join(process.cwd(), "public", "presentations");
  await mkdir(publicDir, { recursive: true });
  const filename = `presentation-${randomUUID()}.pptx`;

  try {
    const result = await generateText({
      model: bedrock("global.anthropic.claude-sonnet-4-6"),
      tools: {
        buildPresentation: tool({
          description: "Build a PowerPoint presentation by writing PptxGenJS JavaScript code that gets executed server-side.",
          inputSchema: z.object({
            audience: z.string().describe("Target audience for the presentation"),
            objective: z.string().describe("The one outcome this presentation achieves"),
            code: z.string().describe("Complete PptxGenJS JavaScript code. Use 'const pptx = new PptxGenJS();' and end with 'return pptx;'"),
            slides: z.array(z.object({
              type: z.enum(["title", "fire", "claim", "proof", "closing"]),
              headline: z.string(),
              bullets: z.array(z.string()).optional(),
            })).describe("Summary of each slide for the live preview"),
          }),
          execute: async ({ code, slides, audience, objective }) => {
            const fn = new Function("PptxGenJS", `"use strict"; return (async () => { ${code} })();`);
            const pptx = await fn(PptxGenJS);

            if (!pptx || typeof pptx.write !== "function") {
              throw new Error("Code did not return a valid PptxGenJS instance. Make sure to end with 'return pptx;'");
            }

            const buffer = Buffer.from(await pptx.write({ outputType: "nodebuffer" }));
            await writeFile(join(publicDir, filename), buffer);

            return {
              success: true,
              downloadUrl: `/api/presentations/${filename}`,
              filename,
              slides,
              title: slides[0]?.headline ?? "Presentation",
              plan: { audience, objective },
            };
          },
        }),
      },
      prompt: buildPrompt(message),
    });

    const toolResult = result.toolResults?.[0];
    if (!toolResult || toolResult.type !== "tool-result") {
      return NextResponse.json({ error: "No presentation generated" }, { status: 500 });
    }

    const response = (toolResult as { output: Record<string, unknown> }).output;
    return NextResponse.json(response);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    console.error("Presentation error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildPrompt(message: string): string {
  return `You are a world-class presentation designer and PptxGenJS expert.
Create a professional, visually stunning presentation for: "${message}"

You MUST call the buildPresentation tool to generate the PPTX file.

DESIGN METHODOLOGY (follow strictly):
1. Define the audience and objective
2. FIRE: Open with a burning problem — shocking statistic, counterintuitive fact, or urgent question
3. CLAIM+PROOF: Each claim slide states one bold argument. Follow with proof slides showing data/evidence.
4. Structure: title → fire (hook) → claim/proof pairs → closing
5. ONE MESSAGE PER SLIDE: headline = one point. Max 3-5 bullets per slide.
6. Use REAL facts, data, specific numbers. Cite sources. No generic filler.
7. Closing: reinforce objective, include call to action

The "code" parameter must be complete, executable PptxGenJS JavaScript.
The "slides" parameter must be an array summarizing each slide for the preview.

PPTXGENJS API REFERENCE:
Available as: PptxGenJS (the constructor is passed as a parameter — do NOT import it)

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33" × 7.5"
pptx.author = "s-slide AI";
pptx.title = "Title";

const slide = pptx.addSlide();
slide.background = { fill: "HEXNOHASH" }; // NO # prefix

// Plain text
slide.addText("text", {
  x: 1, y: 1.8, w: 11, h: 2,
  fontSize: 40, bold: true, color: "FFFFFF",
  fontFace: "Arial", align: "center"
});

// Rich text array (bullets)
slide.addText([
  { text: "Point 1", options: { fontSize: 15, color: "555555", fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 8 } },
  { text: "Point 2", options: { fontSize: 15, color: "555555", fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 8 } },
], { x: 0.7, y: 2.1, w: 11, h: 3.5, valign: "top" });

// Shapes
slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 0.12, h: "100%",
  fill: { type: "solid", color: "7C3AED" }
});

// Images (from URL)
slide.addImage({ path: "https://...", x: 7.5, y: 1.5, w: 4.5, h: 3.5 });

// Tables
slide.addTable([["Header 1", "Header 2"], ["Data 1", "Data 2"]], {
  x: 0.7, y: 2, w: 11.5,
  fontSize: 12, fontFace: "Arial",
  border: { pt: 0.5, color: "E5E7EB" },
  colW: [5.75, 5.75],
  rowH: [0.5, 0.4],
  autoPage: false,
});

return pptx; // MANDATORY

COLOR PALETTE:
- purple: "6B21A8" — title bg, primary headings
- purpleLight: "7C3AED" — accent bars, left sidebar
- purplePale: "A78BFA" — secondary accent, dividers
- purpleMist: "F3F0FF" — proof slide bg
- white: "FFFFFF"
- dark: "1E1B2E" — fire slide bg
- gray: "555555" — body text
- grayLight: "999999" — secondary text, sources
- accent: "F59E0B" — fire slide accent bar

SLIDE DESIGN GUIDE:
Title: bg purple ("6B21A8"), large centered white headline (fontSize: 40), subtitle in purplePale
Fire: bg dark ("1E1B2E"), addText "🔥" as emoji, white bold headline, orange accent bar (addShape rect), grayLight body
Claim: white bg, thin purpleLight left bar (addShape x=0, w=0.12, h="100%"), purple headline, gray bullets
Proof: purpleMist bg ("F3F0FF"), purple headline, data/evidence — use tables or bullets for data
Closing: purple bg, large white headline centered, purplePale subtitle, italic objective

COORDINATE GUIDE (LAYOUT_WIDE: 13.33" × 7.5"):
- Safe area: x: 0.7–12.5, y: 0.5–6.8
- Title: x: 1, y: 1.8, w: 11, h: 2
- Body: x: 0.7, y: 2.1, w: 11.5, h: 3.5
- Divider bar: x: 0.7, y: 1.8, w: 1.5, h: 0.04
- Slide number: x: 11.5, y: 7, w: 0.5, h: 0.3
- Source: x: 0.7, y: 6.3, w: 11.5, h: 0.3

RULES:
- All colors: hex strings WITHOUT # prefix
- fontFace: "Arial" for all text
- Always end with: return pptx;
- Do NOT use require(), import, process, or fs
- Keep slides visually clean with generous spacing
- Use tables for data comparisons, shapes for visual elements
- Be creative with layouts — you're not limited to the templates above`;
}
