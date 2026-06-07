import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { streamObject } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";

const slideSchema = z.object({
  type: z.enum(["title", "fire", "claim", "proof", "closing"]),
  headline: z.string(),
  bullets: z.array(z.string()).optional(),
  imageQuery: z.string().optional().describe("Search term for Pexels stock photo (e.g. 'solar panels', 'team meeting')"),
});

const presentationCodeSchema = z.object({
  audience: z.string(),
  objective: z.string(),
  slides: z.array(slideSchema).describe("Slide summaries, generate these FIRST"),
  code: z.string().describe("PptxGenJS code calling the injected builder functions"),
});

// Design constants, injected into code context
const C = {
  purple: "6B21A8", purpleLight: "7C3AED", purplePale: "A78BFA",
  purpleMist: "F3F0FF", white: "FFFFFF", dark: "1E1B2E",
  gray: "555555", grayLight: "999999",
};

// Builder functions injected into code context, guarantee design consistency
const BUILDER_CODE = `
const F = "Arial";

function titleSlide(pptx, headline, subtitle) {
  const s = pptx.addSlide();
  s.background = { fill: C.purple };
  s.addText(headline, { x: 1.5, y: 2, w: 10, h: 2.5, fontSize: 44, bold: true, color: C.white, fontFace: F, align: "center" });
  if (subtitle) s.addText(subtitle, { x: 1.5, y: 4.5, w: 10, h: 1.2, fontSize: 30, color: C.purplePale, fontFace: F, align: "center" });
  return s;
}

function fireSlide(pptx, headline, body, source) {
  const s = pptx.addSlide();
  s.background = { fill: C.dark };
  s.addText("\\u{1F525}", { x: 1.2, y: 1.5, w: 1.2, h: 1.2, fontSize: 56 });
  s.addText(headline, { x: 2.4, y: 1.5, w: 9, h: 2.5, fontSize: 40, bold: true, color: C.white, fontFace: F });
  s.addShape(pptx.ShapeType.rect, { x: 2.4, y: 3.8, w: 2.5, h: 0.06, fill: { type: "solid", color: C.purpleLight } });
  if (body) s.addText(body, { x: 2.4, y: 4.2, w: 9, h: 1.8, fontSize: 30, color: C.grayLight, fontFace: F, lineSpacingMultiple: 1.5 });
  if (source) s.addText(source, { x: 2.4, y: 6.2, w: 9, h: 0.4, fontSize: 18, color: C.grayLight, fontFace: F, italic: true });
  return s;
}

function claimSlide(pptx, headline, bullets, source, slideNum, imageUrl) {
  const s = pptx.addSlide();
  const hasImage = imageUrl != null;
  const textW = hasImage ? 6.5 : 10.5;
  s.background = { fill: C.white };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { type: "solid", color: C.purpleLight } });
  s.addText(headline, { x: 1.2, y: 0.8, w: textW, h: 1.5, fontSize: 36, bold: true, color: C.purple, fontFace: F });
  s.addShape(pptx.ShapeType.rect, { x: 1.2, y: 2.3, w: 2, h: 0.05, fill: { type: "solid", color: C.purplePale } });
  if (bullets && bullets.length > 0) {
    s.addText(
      bullets.map(b => ({ text: b, options: { fontSize: 30, color: C.gray, fontFace: F, bullet: { code: "25CF" }, paraSpaceAfter: 12 } })),
      { x: 1.2, y: 2.8, w: textW, h: 4, valign: "top" }
    );
  }
  if (hasImage) {
    s.addImage({ path: imageUrl, x: 8.2, y: 1, w: 4.3, h: 5.5, rounding: true });
  }
  if (source) s.addText(source, { x: 1.2, y: 6.8, w: textW, h: 0.4, fontSize: 18, color: C.grayLight, fontFace: F, italic: true });
  if (slideNum) s.addText(String(slideNum), { x: 11.2, y: 7, w: 0.5, h: 0.4, fontSize: 18, color: C.grayLight, fontFace: F, align: "right" });
  return s;
}

function proofSlide(pptx, headline, bullets, source, slideNum, imageUrl) {
  const s = pptx.addSlide();
  const hasImage = imageUrl != null;
  const textW = hasImage ? 6.5 : 10.5;
  s.background = { fill: C.purpleMist };
  s.addText(headline, { x: 1.2, y: 0.8, w: textW, h: 1.2, fontSize: 36, bold: true, color: C.purple, fontFace: F });
  s.addShape(pptx.ShapeType.rect, { x: 1.2, y: 2, w: 2, h: 0.05, fill: { type: "solid", color: C.purplePale } });
  if (bullets && bullets.length > 0) {
    s.addText(
      bullets.map(b => ({ text: b, options: { fontSize: 30, color: C.gray, fontFace: F, bullet: { code: "25CF" }, paraSpaceAfter: 10 } })),
      { x: 1.2, y: 2.5, w: textW, h: 4, valign: "top" }
    );
  }
  if (hasImage) {
    s.addImage({ path: imageUrl, x: 8.2, y: 1, w: 4.3, h: 5.5, rounding: true });
  }
  if (source) s.addText(source, { x: 1.2, y: 6.8, w: textW, h: 0.4, fontSize: 18, color: C.grayLight, fontFace: F, italic: true });
  if (slideNum) s.addText(String(slideNum), { x: 11.2, y: 7, w: 0.5, h: 0.4, fontSize: 18, color: C.grayLight, fontFace: F, align: "right" });
  return s;
}

function closingSlide(pptx, headline, subtitle, callToAction) {
  const s = pptx.addSlide();
  s.background = { fill: C.purple };
  s.addText(headline, { x: 1.5, y: 2, w: 10, h: 2, fontSize: 44, bold: true, color: C.white, fontFace: F, align: "center" });
  if (subtitle) s.addText(subtitle, { x: 1.5, y: 4, w: 10, h: 1.2, fontSize: 30, color: C.purplePale, fontFace: F, align: "center" });
  if (callToAction) s.addText(callToAction, { x: 1.5, y: 5.5, w: 10, h: 0.6, fontSize: 30, color: C.purplePale, fontFace: F, align: "center", italic: true });
  s.addText("Created with s-slide", { x: 1.5, y: 6.5, w: 10, h: 0.5, fontSize: 18, color: C.purplePale, fontFace: F, align: "center" });
  return s;
}
`;

async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=large`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.photos?.[0]?.src?.large ?? null;
  } catch {
    return null;
  }
}

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

  const result = streamObject({
    model: bedrock("global.anthropic.claude-sonnet-4-6"),
    schema: presentationCodeSchema,
    prompt: buildPrompt(message),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullCode = "";
      let lastSlideCount = 0;
      let finalSlides: { imageQuery?: string }[] = [];

      try {
        for await (const partial of result.partialObjectStream) {
          const slides = partial.slides;
          if (slides && slides.length > lastSlideCount) {
            lastSlideCount = slides.length;
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "slides", slides })}\n\n`
            ));
          }
          if (slides) finalSlides = slides as { imageQuery?: string }[];
          if (partial.code) fullCode = partial.code;
        }

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "building" })}\n\n`
        ));

        // Fetch images from Pexels based on slide imageQuery
        const imageUrls = await Promise.all(
          finalSlides.map(s => s.imageQuery ? fetchPexelsImage(s.imageQuery) : Promise.resolve(null))
        );
        const imageMap: Record<number, string> = {};
        imageUrls.forEach((url, i) => { if (url) imageMap[i] = url; });

        console.log("[create-presentation] Executing code, slides:", lastSlideCount, "images:", Object.keys(imageMap).length);

        const fn = new Function(
          "PptxGenJS", "C", "imageMap",
          `"use strict"; ${BUILDER_CODE} return (async () => { ${fullCode} })();`
        );
        const pptx = await fn(PptxGenJS, C, imageMap);

        if (!pptx || typeof pptx.write !== "function") {
          throw new Error("Generated code did not return a PptxGenJS instance");
        }

        const buffer = Buffer.from(await pptx.write({ outputType: "nodebuffer" }));
        await writeFile(join(publicDir, filename), buffer);

        console.log("[create-presentation] Done. File:", filename, "Size:", buffer.length);

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({
            type: "done",
            downloadUrl: `/api/presentations/${filename}`,
            filename,
          })}\n\n`
        ));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        console.error("[create-presentation] Error:", msg);
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`
        ));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

function buildPrompt(message: string): string {
  return `Create a professional presentation for: "${message}"

Generate a JSON object with: audience, objective, slides, code.
IMPORTANT: Generate "slides" array FIRST (for live preview), then "code" last.

The "code" field calls INJECTED BUILDER FUNCTIONS. They handle ALL styling automatically.
You ONLY provide content: colors, fonts, positions, margins are locked in.

AVAILABLE FUNCTIONS (already defined, just call them):

titleSlide(pptx, headline, subtitle?)
  Purple bg, centered white headline, purplePale subtitle

fireSlide(pptx, headline, body?, source?)
  Dark bg, fire emoji, white headline, purple accent bar, grayLight body

claimSlide(pptx, headline, bullets?, source?, slideNum?, imageUrl?)
  White bg, purpleLight left accent bar, purple headline, gray bullets
  If imageUrl is provided: text narrows to left 60%, image on right 40%

proofSlide(pptx, headline, bullets?, source?, slideNum?, imageUrl?)
  PurpleMist bg, purple headline, gray bullets
  If imageUrl is provided: text narrows to left 60%, image on right 40%

closingSlide(pptx, headline, subtitle?, callToAction?)
  Purple bg, centered white headline, purplePale subtitle

IMAGE MAP: imageMap is available in scope. It maps slide index to a Pexels photo URL.
Pass imageMap[i] as the last argument to claimSlide/proofSlide for slides that need photos.
Example: claimSlide(pptx, "Solar Energy", ["panels"], null, 2, imageMap[2])

SLIDE IMAGEQUERIES: For each content slide (claim, proof), provide an "imageQuery" field
with a 1-3 word search term for a relevant stock photo (e.g. "solar panels", "team meeting", "data center").
Leave imageQuery empty for title, fire, and closing slides.

EXAMPLE CODE:
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "s-slide AI";
pptx.title = "Proxmox in the Homelab";

titleSlide(pptx, "Proxmox in the Homelab", "Open-Source Virtualization Powerhouse");
fireSlide(pptx, "You're Wasting 90% of Your Hardware", "Most servers run at <10% CPU utilization...");
claimSlide(pptx, "Proxmox Is the #1 Choice", ["Enterprise-grade KVM + LXC", "Zero licensing cost"], null, 3, imageMap[2]);
proofSlide(pptx, "Proxmox vs Competition", ["Free vs VMware $995+/yr", "Active community"], "proxmox.com", 4, imageMap[3]);
closingSlide(pptx, "Start Your Homelab Journey", "Enterprise power, zero cost", "Download at proxmox.com");

return pptx;

For tables or custom layouts you CAN use raw PptxGenJS (pptx.addSlide(), slide.addTable, etc.)
but ONLY use these colors: C.purple, C.purpleLight, C.purplePale, C.purpleMist, C.white, C.dark, C.gray, C.grayLight
and ALWAYS use fontFace: "Arial".

DESIGN PRINCIPLES (NON-NEGOTIABLE):
1. ONE IDEA PER SLIDE: each slide makes exactly ONE point
2. 30 WORDS MAX per slide: less is more, use visuals over text
3. FIRE opener: shocking statistic, counterintuitive fact, or urgent problem
4. CLAIM+PROOF: claim slides state one bold argument, proof slides show evidence
5. Structure: title -> fire -> claim/proof pairs -> closing
6. MAX 3 BULLETS per slide: prefer tables, charts, or bold single statements over bullet lists
7. Use REAL facts, data, specific numbers. Cite sources.
8. Closing reinforces objective with call to action
9. Every claim/proof slide should have an imageQuery for a relevant stock photo

CRITICAL RULES:
- Use the builder functions (titleSlide, fireSlide, etc.) for all standard slides
- NEVER hardcode colors: use C.purple, C.white, etc. if you need raw PptxGenJS
- NEVER hardcode "Arial": use the F variable
- End with: return pptx;
- Create as many slides as needed
- NEVER use em-dashes (the long dash character). Use colons, periods, or commas instead`;
}
