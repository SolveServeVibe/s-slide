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
  code: z.string().describe("PptxGenJS code using C and D variables for design consistency"),
  slides: z.array(z.object({
    type: z.enum(["title", "fire", "claim", "proof", "closing"]),
    headline: z.string(),
    bullets: z.array(z.string()).optional(),
  })).describe("Slide summaries for preview"),
});

// Design system — injected into code execution context
const DESIGN_SYSTEM = {
  colors: {
    purple: "6B21A8",
    purpleLight: "7C3AED",
    purplePale: "A78BFA",
    purpleMist: "F3F0FF",
    white: "FFFFFF",
    dark: "1E1B2E",
    gray: "555555",
    grayLight: "999999",
    accent: "F59E0B",
  },
  font: "Arial",
  layout: {
    wide: "LAYOUT_WIDE",
    safeX: 0.7,
    safeY: 0.5,
    titleHeadline: { x: 1, y: 1.8, w: 11, h: 2, fontSize: 40 },
    titleSubtitle: { x: 1, y: 3.8, w: 11, h: 1, fontSize: 18 },
    headline: { x: 0.7, y: 0.5, w: 11.5, h: 1.2, fontSize: 28 },
    body: { x: 0.7, y: 2.1, w: 11.5, h: 3.5, fontSize: 16 },
    divider: { x: 0.7, y: 1.8, w: 1.5, h: 0.04 },
    accentBar: { x: 0, y: 0, w: 0.12, h: "100%" },
    slideNum: { x: 11.5, y: 7, w: 0.5, h: 0.3, fontSize: 10 },
    source: { x: 0.7, y: 6.3, w: 11.5, h: 0.3, fontSize: 9 },
  },
};

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

    const fn = new Function(
      "PptxGenJS", "C", "D", "L",
      `"use strict"; return (async () => { ${object.code} })();`
    );
    const pptx = await fn(PptxGenJS, DESIGN_SYSTEM.colors, DESIGN_SYSTEM, DESIGN_SYSTEM.layout);

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
  return `Create a professional presentation for: "${message}"

Generate a JSON object with: audience, objective, code, slides.

The "code" field contains PptxGenJS JavaScript. It receives these variables:

C (colors) — USE THESE FOR ALL COLORS, never hardcode hex:
  C.purple    = "6B21A8"  (title bg, primary headings)
  C.purpleLight = "7C3AED" (accent bars, left sidebar)
  C.purplePale  = "A78BFA" (secondary accent)
  C.purpleMist  = "F3F0FF" (proof slide bg)
  C.white     = "FFFFFF"
  C.dark      = "1E1B2E"  (fire slide bg)
  C.gray      = "555555"  (body text)
  C.grayLight = "999999"  (secondary text, sources)
  C.accent    = "F59E0B"  (fire accent bar)

D (design system) — D.font = "Arial", D.colors = C, D.layout = L
L (layout) — preset coordinates:
  L.titleHeadline  = { x:1, y:1.8, w:11, h:2, fontSize:40 }
  L.titleSubtitle  = { x:1, y:3.8, w:11, h:1, fontSize:18 }
  L.headline       = { x:0.7, y:0.5, w:11.5, h:1.2, fontSize:28 }
  L.body           = { x:0.7, y:2.1, w:11.5, h:3.5, fontSize:16 }
  L.divider        = { x:0.7, y:1.8, w:1.5, h:0.04 }
  L.accentBar      = { x:0, y:0, w:0.12, h:"100%" }
  L.slideNum       = { x:11.5, y:7, w:0.5, h:0.3, fontSize:10 }
  L.source         = { x:0.7, y:6.3, w:11.5, h:0.3, fontSize:9 }

Use spread to apply: slide.addText("Title", { ...L.titleHeadline, color: C.white, bold: true, fontFace: D.font, align: "center" });

DESIGN METHODOLOGY:
1. FIRE opener: shocking statistic, counterintuitive fact, or urgent problem
2. CLAIM+PROOF: claim slides state one bold argument, proof slides show evidence
3. Structure: title -> fire -> claim/proof pairs -> closing
4. ONE MESSAGE PER SLIDE, 3-5 bullets max
5. Use REAL facts, data, specific numbers. Cite sources.
6. Closing reinforces objective with call to action

SLIDE TYPES:
Title:  bg C.purple, centered white headline (...L.titleHeadline), subtitle in C.purplePale
Fire:   bg C.dark, fire emoji, white bold headline, C.accent underline bar, C.grayLight body
Claim:  bg C.white, C.purpleLight left bar (...L.accentBar), C.purple headline, C.gray bullets
Proof:  bg C.purpleMist, C.purple headline, evidence in bullets or tables
Closing: bg C.purple, centered white headline, C.purplePale subtitle

PptxGenJS API:
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; pptx.author = "s-slide AI"; pptx.title = "...";
  const slide = pptx.addSlide();
  slide.background = { fill: C.purple };
  slide.addText("text", { ...L.titleHeadline, color: C.white, fontFace: D.font, align: "center" });
  slide.addText([{ text: "Point", options: { fontSize:15, color:C.gray, fontFace:D.font, bullet:{code:"25CF"}, paraSpaceAfter:8 }}], { ...L.body, valign:"top" });
  slide.addShape(pptx.ShapeType.rect, { ...L.accentBar, fill:{type:"solid",color:C.purpleLight} });
  slide.addTable([["H1","H2"],["D1","D2"]], { x:0.7, y:2, w:11.5, fontSize:12, fontFace:D.font, border:{pt:0.5,color:"E5E7EB"} });
  return pptx; // MANDATORY last line

CRITICAL RULES:
- ALWAYS use C.purple, C.white, etc. — NEVER hardcode hex colors like "6B21A8"
- ALWAYS use fontFace: D.font — NEVER hardcode "Arial"
- ALWAYS use L.* for positions — consistent spacing across slides
- NEVER use require(), import, process, or fs
- End with: return pptx;
- Create as many slides as needed to cover the topic thoroughly.`;
}
