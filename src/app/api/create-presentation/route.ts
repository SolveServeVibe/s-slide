import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject } from "ai";
import { z } from "zod";
import PptxGenJS from "pptxgenjs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const slideSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()),
  notes: z.string().optional(),
});

const presentationSchema = z.object({
  presentationTitle: z.string(),
  slides: z.array(slideSchema),
});

export async function POST(req: Request) {
  const { message } = await req.json();

  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  // Step 1: AI generates structured slide content
  const { object } = await generateObject({
    model: bedrock("global.anthropic.claude-sonnet-4-6"),
    schema: presentationSchema,
    prompt: `Create a professional presentation based on this request: "${message}"

Rules:
- Create compelling, informative content - no generic filler
- Each slide should have a clear title and 3-5 bullet points
- Use specific facts, data, and insights
- First slide is the title slide (subtitle only, no bullets)
- Last slide is a summary/conclusion
- Make the content genuinely useful and educational`,
  });

  // Step 2: Generate the PPTX using PptxGenJS
  const pptx = new PptxGenJS();
  pptx.author = "s-slide AI";
  pptx.company = "s-slide";
  pptx.title = object.presentationTitle;
  pptx.layout = "LAYOUT_WIDE";

  for (let i = 0; i < object.slides.length; i++) {
    const slide = object.slides[i];
    const s = pptx.addSlide();

    if (i === 0) {
      // Title slide
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { type: "solid", color: "6B21A8" } });
      s.addText(slide.title, {
        x: 0.8, y: 2, w: 11.2, h: 1.5,
        fontSize: 40, bold: true, color: "FFFFFF", align: "center", fontFace: "Arial",
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8, y: 3.7, w: 11.2, h: 0.8,
          fontSize: 18, color: "C4B5FD", align: "center", fontFace: "Arial",
        });
      }
      s.addText("Created with s-slide", {
        x: 0.8, y: 5.8, w: 11.2, h: 0.4,
        fontSize: 12, color: "A78BFA", align: "center", fontFace: "Arial",
      });
    } else {
      // Content slide with purple accent bar
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: "100%", fill: { type: "solid", color: "7C3AED" } });
      s.addText(slide.title, {
        x: 0.6, y: 0.3, w: 11.5, h: 0.8,
        fontSize: 26, bold: true, color: "6B21A8", fontFace: "Arial",
      });
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.15, w: 1.5, h: 0.04, fill: { type: "solid", color: "A78BFA" } });

      const bullets = slide.bullets.map(b => ({
        text: b,
        options: { fontSize: 15, color: "333333", fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 6 },
      }));
      s.addText(bullets, { x: 0.6, y: 1.5, w: 11.5, h: 4, valign: "top" });

      // Slide number
      s.addText(`${i + 1}`, {
        x: 11.5, y: 7, w: 0.5, h: 0.3,
        fontSize: 10, color: "AAAAAA", align: "right", fontFace: "Arial",
      });
    }
  }

  // Save file
  const publicDir = join(process.cwd(), "public", "presentations");
  await mkdir(publicDir, { recursive: true });
  const filename = `presentation-${randomUUID()}.pptx`;
  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  await writeFile(join(publicDir, filename), buffer);

  return NextResponse.json({
    success: true,
    downloadUrl: `/api/presentations/${filename}`,
    filename,
    slides: object.slides,
    title: object.presentationTitle,
  });
}
