// Presentation design system based on professional slide methodology
// Inspired by: "How to make good presentation slides" by Tim Metz

import { z } from "zod";
import PptxGenJS from "pptxgenjs";
import { execFile } from "child_process";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// ── Schemas ──

const imageSchema = z.object({
  url: z.string().optional().describe("Public image URL to embed"),
  mermaid: z.string().optional().describe("Mermaid.js diagram code - rendered to SVG and embedded"),
  position: z.enum(["right", "bottom", "center"]).default("right").describe("Where to place the image"),
});

export const slideSchema = z.object({
  type: z.enum(["title", "fire", "claim", "proof", "closing"]).describe("Slide type"),
  headline: z.string().describe("One clear message - the single point this slide makes"),
  body: z.string().optional().describe("Supporting text, data point, or context (keep short)"),
  bullets: z.array(z.string()).optional().describe("3-5 max supporting points"),
  source: z.string().optional().describe("Data source attribution"),
  image: imageSchema.optional().describe("Image or Mermaid diagram to embed on this slide"),
});

export const presentationSchema = z.object({
  audience: z.string().describe("Who this presentation is for"),
  setting: z.enum(["live", "email", "hybrid"]).describe("How the presentation will be delivered"),
  objective: z.string().describe("The one outcome you want to achieve"),
  fire: z.string().describe("The burning problem/opener - what hooks the audience"),
  slides: z.array(slideSchema).min(3).max(20),
});
export type PresentationPlan = z.infer<typeof presentationSchema>;
export type SlideData = z.infer<typeof slideSchema>;

// ── Colors ──

const C = {
  purple: "6B21A8", purpleLight: "7C3AED", purplePale: "A78BFA",
  purpleMist: "F3F0FF", white: "FFFFFF", dark: "1E1B2E",
  gray: "555555", grayLight: "999999", accent: "F59E0B",
};

// ── Mermaid Renderer ──

export async function renderMermaidToSvg(mermaidCode: string): Promise<string> {
  const tmpDir = join(process.cwd(), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const id = randomUUID();
  const inFile = join(tmpDir, `${id}.mmd`);
  const outFile = join(tmpDir, `${id}.svg`);

  await writeFile(inFile, mermaidCode);

  return new Promise((resolve, reject) => {
    execFile("npx", ["mmdc", "-i", inFile, "-o", outFile, "-b", "transparent"], {
      timeout: 30000,
    }, async (err) => {
      if (err) { reject(err); return; }
      const svg = await readFile(outFile, "utf-8");
      resolve(svg);
    });
  });
}

// ── PptxGenJS Builder ──

interface ResolvedImage {
  path: string; // local file path to SVG or PNG
  position: "right" | "bottom" | "center";
}

export async function buildPptx(plan: PresentationPlan): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.author = "s-slide AI";
  pptx.company = "s-slide";
  pptx.title = plan.slides[0]?.headline ?? "Presentation";
  pptx.layout = "LAYOUT_WIDE";

  // Pre-render all mermaid diagrams
  const images: Map<number, ResolvedImage> = new Map();
  for (let i = 0; i < plan.slides.length; i++) {
    const img = plan.slides[i].image;
    if (img?.mermaid) {
      const svgPath = join(process.cwd(), "public", "presentations", `diagram-${randomUUID()}.svg`);
      const svg = await renderMermaidToSvg(img.mermaid);
      await writeFile(svgPath, svg);
      images.set(i, { path: svgPath, position: img.position || "right" });
    } else if (img?.url) {
      images.set(i, { path: img.url, position: img.position || "right" });
    }
  }

  for (let i = 0; i < plan.slides.length; i++) {
    const s = plan.slides[i];
    const slide = pptx.addSlide();
    const img = images.get(i);

    switch (s.type) {
      case "title": buildTitleSlide(slide, s, pptx, plan); break;
      case "fire": buildFireSlide(slide, s, pptx); break;
      case "claim": buildClaimSlide(slide, s, pptx, i, img); break;
      case "proof": buildProofSlide(slide, s, pptx, i, img); break;
      case "closing": buildClosingSlide(slide, s, pptx, plan); break;
    }

    // Add image if present
    if (img) {
      addImageToSlide(slide, img, pptx);
    }
  }
  return pptx;
}

function addImageToSlide(slide: PptxGenJS.Slide, img: ResolvedImage, pptx: PptxGenJS) {
  const opts: PptxGenJS.ImageProps = { path: img.path };
  switch (img.position) {
    case "right":
      opts.x = 7.5; opts.y = 1.5; opts.w = 4.5; opts.h = 3.5;
      break;
    case "center":
      opts.x = 2; opts.y = 2; opts.w = 8; opts.h = 4;
      break;
    case "bottom":
      opts.x = 1; opts.y = 4; opts.w = 10; opts.h = 2.5;
      break;
  }
  slide.addImage(opts);
}

function buildTitleSlide(s: PptxGenJS.Slide, d: SlideData, pptx: PptxGenJS, plan: PresentationPlan) {
  s.background = { fill: C.purple };
  s.addText(d.headline, { x: 1, y: 1.8, w: 11, h: 2, fontSize: 40, bold: true, color: C.white, align: "center", fontFace: "Arial" });
  if (d.body) s.addText(d.body, { x: 1, y: 3.8, w: 11, h: 1, fontSize: 18, color: C.purplePale, align: "center", fontFace: "Arial" });
  s.addText(`Prepared for: ${plan.audience}`, { x: 1, y: 6.5, w: 11, h: 0.4, fontSize: 11, color: "9F7AEA", align: "center", fontFace: "Arial" });
}

function buildFireSlide(s: PptxGenJS.Slide, d: SlideData, pptx: PptxGenJS) {
  s.background = { fill: C.dark };
  s.addText("🔥", { x: 0.8, y: 1.5, w: 1, h: 1, fontSize: 48 });
  s.addText(d.headline, { x: 1.8, y: 1.5, w: 9.5, h: 2, fontSize: 36, bold: true, color: C.white, fontFace: "Arial" });
  if (d.body) s.addText(d.body, { x: 1.8, y: 3.6, w: 9.5, h: 1.5, fontSize: 18, color: C.grayLight, fontFace: "Arial", lineSpacingMultiple: 1.4 });
  if (d.source) s.addText(d.source, { x: 1.8, y: 5.5, w: 9.5, h: 0.3, fontSize: 10, color: C.grayLight, fontFace: "Arial", italic: true });
  s.addShape(pptx.ShapeType.rect, { x: 1.8, y: 3.2, w: 2, h: 0.05, fill: { type: "solid", color: C.accent } });
}

function buildClaimSlide(s: PptxGenJS.Slide, d: SlideData, pptx: PptxGenJS, idx: number, img?: ResolvedImage) {
  s.background = { fill: C.white };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: "100%", fill: { type: "solid", color: C.purpleLight } });
  const textW = img ? 7 : 11.5;
  s.addText(d.headline, { x: 0.7, y: 0.5, w: textW, h: 1.2, fontSize: 28, bold: true, color: C.purple, fontFace: "Arial" });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.8, w: 1.5, h: 0.04, fill: { type: "solid", color: C.purplePale } });
  if (d.bullets && d.bullets.length > 0) {
    const bt = d.bullets.map(b => ({ text: b, options: { fontSize: 15, color: C.gray, fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 8 } }));
    s.addText(bt, { x: 0.7, y: 2.1, w: textW, h: 3.5, valign: "top" });
  } else if (d.body) {
    s.addText(d.body, { x: 0.7, y: 2.1, w: textW, h: 3, fontSize: 16, color: C.gray, fontFace: "Arial", lineSpacingMultiple: 1.4 });
  }
  if (d.source) s.addText(d.source, { x: 0.7, y: 6.3, w: 11.5, h: 0.3, fontSize: 9, color: C.grayLight, fontFace: "Arial", italic: true });
  s.addText(`${idx + 1}`, { x: 11.5, y: 7, w: 0.5, h: 0.3, fontSize: 10, color: C.grayLight, align: "right", fontFace: "Arial" });
}

function buildProofSlide(s: PptxGenJS.Slide, d: SlideData, pptx: PptxGenJS, idx: number, img?: ResolvedImage) {
  s.background = { fill: C.purpleMist };
  const textW = img ? 7 : 11.5;
  s.addText(d.headline, { x: 0.7, y: 0.5, w: textW, h: 0.8, fontSize: 24, bold: true, color: C.purple, fontFace: "Arial" });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.4, w: 1.5, h: 0.04, fill: { type: "solid", color: C.purplePale } });
  if (d.body) s.addText(d.body, { x: 0.7, y: 1.7, w: textW, h: 3.5, fontSize: 18, color: C.dark, fontFace: "Arial", lineSpacingMultiple: 1.5 });
  if (d.bullets && d.bullets.length > 0) {
    const bt = d.bullets.map(b => ({ text: b, options: { fontSize: 14, color: C.gray, fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 6 } }));
    s.addText(bt, { x: 0.7, y: 2.2, w: textW, h: 3.5, valign: "top" });
  }
  if (d.source) s.addText(d.source, { x: 0.7, y: 6.3, w: 11.5, h: 0.3, fontSize: 9, color: C.grayLight, fontFace: "Arial", italic: true });
  s.addText(`${idx + 1}`, { x: 11.5, y: 7, w: 0.5, h: 0.3, fontSize: 10, color: C.grayLight, align: "right", fontFace: "Arial" });
}

function buildClosingSlide(s: PptxGenJS.Slide, d: SlideData, pptx: PptxGenJS, plan: PresentationPlan) {
  s.background = { fill: C.purple };
  s.addText(d.headline, { x: 1, y: 1.8, w: 11, h: 1.5, fontSize: 40, bold: true, color: C.white, align: "center", fontFace: "Arial" });
  if (d.body) s.addText(d.body, { x: 1, y: 3.5, w: 11, h: 1, fontSize: 16, color: C.purplePale, align: "center", fontFace: "Arial" });
  s.addText(`Objective: ${plan.objective}`, { x: 1, y: 5, w: 11, h: 0.5, fontSize: 12, color: "9F7AEA", align: "center", fontFace: "Arial", italic: true });
  s.addText("Created with s-slide", { x: 1, y: 6.5, w: 11, h: 0.4, fontSize: 11, color: "9F7AEA", align: "center", fontFace: "Arial" });
}
