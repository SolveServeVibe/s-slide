import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";

const presentationCodeSchema = z.object({
  audience: z.string(),
  objective: z.string(),
  code: z.string().describe("Complete PptxGenJS JavaScript code creating the presentation. Must start with 'const pptx = new PptxGenJS();' and end with 'return pptx;'"),
  slides: z.array(z.object({
    type: z.enum(["title", "fire", "claim", "proof", "closing"]),
    headline: z.string(),
    bullets: z.array(z.string()).optional(),
  })).describe("Summary of each slide for the live preview"),
});

export async function POST(req: Request) {
  const { message } = await req.json();
  console.log("[create-presentation] Starting for:", message);

  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  const publicDir = join(process.cwd(), "public", "presentations");
  await mkdir(publicDir, { recursive: true });
  const filename = `presentation-${randomUUID()}.pptx`;

  try {
    console.log("[create-presentation] Calling Bedrock...");
    const { object } = await generateObject({
      model: bedrock("global.anthropic.claude-sonnet-4-6"),
      schema: presentationCodeSchema,
      prompt: buildPrompt(message),
    });

    console.log("[create-presentation] Got code, executing... Slides:", object.slides.length);

    const fn = new Function("PptxGenJS", `"use strict"; return (async () => { ${object.code} })();`);
    const pptx = await fn(PptxGenJS);

    if (!pptx || typeof pptx.write !== "function") {
      throw new Error("Generated code did not return a PptxGenJS instance");
    }

    const buffer = Buffer.from(await pptx.write({ outputType: "nodebuffer" }));
    await writeFile(join(publicDir, filename), buffer);

    console.log("[create-presentation] Done. File:", filename, "Size:", buffer.length);

    return NextResponse.json({
      success: true,
      downloadUrl: `/api/presentations/${filename}`,
      filename,
      slides: object.slides,
      title: object.slides[0]?.headline ?? "Presentation",
      plan: { audience: object.audience, objective: object.objective },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    console.error("[create-presentation] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildPrompt(message: string): string {
  return `You are a world-class presentation designer and PptxGenJS expert.
Create a professional, visually stunning presentation for: "${message}"

You will generate a JSON object with:
- audience: target audience
- objective: desired outcome
- code: complete PptxGenJS JavaScript code (see API reference below)
- slides: array of slide summaries for the preview

DESIGN METHODOLOGY (follow strictly):
1. Define the audience and objective
2. FIRE: Open with a burning problem — shocking statistic, counterintuitive fact, or urgent question
3. CLAIM+PROOF: Each claim slide states one bold argument. Follow with proof slides showing data/evidence.
4. Structure: title → fire (hook) → claim/proof pairs → closing
5. ONE MESSAGE PER SLIDE: headline = one point. Max 3-5 bullets per slide.
6. Use REAL facts, data, specific numbers. Cite sources. No generic filler.
7. Closing: reinforce objective, include call to action

The "code" field must contain complete, executable PptxGenJS JavaScript.

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

// Tables
slide.addTable([["Header 1", "Header 2"], ["Data 1", "Data 2"]], {
  x: 0.7, y: 2, w: 11.5,
  fontSize: 12, fontFace: "Arial",
  border: { pt: 0.5, color: "E5E7EB" },
  colW: [5.75, 5.75],
  rowH: [0.5, 0.4],
  autoPage: false,
});

return pptx; // MANDATORY — must be the last line

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
Fire: bg dark ("1E1B2E"), addText with fire emoji, white bold headline, orange accent bar (addShape rect), grayLight body
Claim: white bg, thin purpleLight left bar (addShape x=0, w=0.12, h="100%"), purple headline, gray bullets
Proof: purpleMist bg ("F3F0FF"), purple headline, data/evidence — use tables or bullets for data
Closing: purple bg, large white headline centered, purplePale subtitle, italic objective

COORDINATE GUIDE (LAYOUT_WIDE: 13.33" × 7.5"):
- Safe area: x: 0.7-12.5, y: 0.5-6.8
- Title: x: 1, y: 1.8, w: 11, h: 2
- Body: x: 0.7, y: 2.1, w: 11.5, h: 3.5
- Divider bar: x: 0.7, y: 1.8, w: 1.5, h: 0.04
- Slide number: x: 11.5, y: 7, w: 0.5, h: 0.3
- Source: x: 0.7, y: 6.3, w: 11.5, h: 0.3

RULES:
- All colors: hex strings WITHOUT # prefix
- fontFace: "Arial" for all text
- Always end code with: return pptx;
- Do NOT use require(), import, process, or fs
- Keep slides visually clean with generous spacing
- Be creative with layouts — you are not limited to the templates above`;
}
