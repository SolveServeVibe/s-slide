// Presentation design system based on professional slide methodology
// Inspired by: "How to make good presentation slides" by Tim Metz

import { z } from "zod";

// ── Schemas ──

export const slideSchema = z.object({
  type: z.enum(["title", "fire", "claim", "proof", "closing"]).describe("Slide type"),
  headline: z.string().describe("One clear message - the single point this slide makes"),
  body: z.string().optional().describe("Supporting text, data point, or context (keep short)"),
  bullets: z.array(z.string()).optional().describe("3-5 max supporting points"),
  source: z.string().optional().describe("Data source attribution"),
});

export const presentationSchema = z.object({
  audience: z.string().describe("Who this presentation is for"),
  setting: z.enum(["live", "email", "hybrid"]).describe("How the presentation will be delivered"),
  objective: z.string().describe("The one outcome you want to achieve"),
  fire: z.string().describe("The burning problem/opener - what hooks the audience"),
  slides: z.array(slideSchema).min(3).max(20),
});
export type PresentationPlan = z.infer<typeof presentationSchema>;

// ── PptxGenJS Builder ──

import PptxGenJS from "pptxgenjs";

const C = {
  purple: "6B21A8",
  purpleLight: "7C3AED",
  purplePale: "A78BFA",
  purpleMist: "F3F0FF",
  white: "FFFFFF",
  dark: "1E1B2E",
  gray: "555555",
  grayLight: "999999",
  accent: "F59E0B",
};

export function buildPptx(plan: PresentationPlan): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.author = "s-slide AI";
  pptx.company = "s-slide";
  pptx.title = plan.slides[0]?.headline ?? "Presentation";
  pptx.layout = "LAYOUT_WIDE";

  for (let i = 0; i < plan.slides.length; i++) {
    const s = plan.slides[i];
    const slide = pptx.addSlide();

    switch (s.type) {
      case "title":
        buildTitleSlide(slide, s, pptx, plan);
        break;
      case "fire":
        buildFireSlide(slide, s, pptx);
        break;
      case "claim":
        buildClaimSlide(slide, s, pptx, i, plan.slides.length);
        break;
      case "proof":
        buildProofSlide(slide, s, pptx, i, plan.slides.length);
        break;
      case "closing":
        buildClosingSlide(slide, s, pptx, plan);
        break;
    }
  }
  return pptx;
}

function buildTitleSlide(s: PptxGenJS.Slide, data: z.infer<typeof slideSchema>, pptx: PptxGenJS, plan: PresentationPlan) {
  s.background = { fill: C.purple };
  // Large centered headline
  s.addText(data.headline, {
    x: 1, y: 1.8, w: 11, h: 2,
    fontSize: 40, bold: true, color: C.white, align: "center", fontFace: "Arial",
  });
  if (data.body) {
    s.addText(data.body, {
      x: 1, y: 3.8, w: 11, h: 1,
      fontSize: 18, color: C.purplePale, align: "center", fontFace: "Arial",
    });
  }
  // Footer with audience context
  s.addText(`Prepared for: ${plan.audience}`, {
    x: 1, y: 6.5, w: 11, h: 0.4,
    fontSize: 11, color: "9F7AEA", align: "center", fontFace: "Arial",
  });
}

function buildFireSlide(s: PptxGenJS.Slide, data: z.infer<typeof slideSchema>, pptx: PptxGenJS) {
  s.background = { fill: C.dark };
  // Fire emoji + headline
  s.addText("🔥", { x: 0.8, y: 1.5, w: 1, h: 1, fontSize: 48 });
  s.addText(data.headline, {
    x: 1.8, y: 1.5, w: 9.5, h: 2,
    fontSize: 36, bold: true, color: C.white, fontFace: "Arial",
  });
  if (data.body) {
    s.addText(data.body, {
      x: 1.8, y: 3.6, w: 9.5, h: 1.5,
      fontSize: 18, color: C.grayLight, fontFace: "Arial", lineSpacingMultiple: 1.4,
    });
  }
  if (data.source) {
    s.addText(data.source, {
      x: 1.8, y: 5.5, w: 9.5, h: 0.3,
      fontSize: 10, color: C.grayLight, fontFace: "Arial", italic: true,
    });
  }
  // Accent line
  s.addShape(pptx.ShapeType.rect, { x: 1.8, y: 3.2, w: 2, h: 0.05, fill: { type: "solid", color: C.accent } });
}

function buildClaimSlide(s: PptxGenJS.Slide, data: z.infer<typeof slideSchema>, pptx: PptxGenJS, idx: number, total: number) {
  s.background = { fill: C.white };
  // Purple left bar
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: "100%", fill: { type: "solid", color: C.purpleLight } });
  // Headline as large blockquote (Donald Chung method)
  s.addText(data.headline, {
    x: 0.7, y: 0.5, w: 11.5, h: 1.2,
    fontSize: 28, bold: true, color: C.purple, fontFace: "Arial",
  });
  // Divider
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.8, w: 1.5, h: 0.04, fill: { type: "solid", color: C.purplePale } });

  if (data.bullets && data.bullets.length > 0) {
    const bulletTexts = data.bullets.map(b => ({
      text: b,
      options: { fontSize: 15, color: C.gray, fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 8, indentLevel: 0 },
    }));
    s.addText(bulletTexts, { x: 0.7, y: 2.1, w: 11.5, h: 3.5, valign: "top" });
  } else if (data.body) {
    s.addText(data.body, {
      x: 0.7, y: 2.1, w: 11.5, h: 3,
      fontSize: 16, color: C.gray, fontFace: "Arial", lineSpacingMultiple: 1.4,
    });
  }

  if (data.source) {
    s.addText(data.source, {
      x: 0.7, y: 6.3, w: 11.5, h: 0.3,
      fontSize: 9, color: C.grayLight, fontFace: "Arial", italic: true,
    });
  }
  // Slide number
  s.addText(`${idx + 1}`, { x: 11.5, y: 7, w: 0.5, h: 0.3, fontSize: 10, color: C.grayLight, align: "right", fontFace: "Arial" });
}

function buildProofSlide(s: PptxGenJS.Slide, data: z.infer<typeof slideSchema>, pptx: PptxGenJS, idx: number, total: number) {
  s.background = { fill: C.purpleMist };
  // Headline
  s.addText(data.headline, {
    x: 0.7, y: 0.5, w: 11.5, h: 0.8,
    fontSize: 24, bold: true, color: C.purple, fontFace: "Arial",
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.4, w: 1.5, h: 0.04, fill: { type: "solid", color: C.purplePale } });

  // Body as data/proof
  if (data.body) {
    s.addText(data.body, {
      x: 0.7, y: 1.7, w: 11.5, h: 3.5,
      fontSize: 18, color: C.dark, fontFace: "Arial", lineSpacingMultiple: 1.5,
    });
  }

  if (data.bullets && data.bullets.length > 0) {
    const bulletTexts = data.bullets.map(b => ({
      text: b,
      options: { fontSize: 14, color: C.gray, fontFace: "Arial", bullet: { code: "25CF" }, paraSpaceAfter: 6 },
    }));
    s.addText(bulletTexts, { x: 0.7, y: 2.2, w: 11.5, h: 3.5, valign: "top" });
  }

  if (data.source) {
    s.addText(data.source, {
      x: 0.7, y: 6.3, w: 11.5, h: 0.3,
      fontSize: 9, color: C.grayLight, fontFace: "Arial", italic: true,
    });
  }
  s.addText(`${idx + 1}`, { x: 11.5, y: 7, w: 0.5, h: 0.3, fontSize: 10, color: C.grayLight, align: "right", fontFace: "Arial" });
}

function buildClosingSlide(s: PptxGenJS.Slide, data: z.infer<typeof slideSchema>, pptx: PptxGenJS, plan: PresentationPlan) {
  s.background = { fill: C.purple };
  s.addText(data.headline, {
    x: 1, y: 1.8, w: 11, h: 1.5,
    fontSize: 40, bold: true, color: C.white, align: "center", fontFace: "Arial",
  });
  if (data.body) {
    s.addText(data.body, {
      x: 1, y: 3.5, w: 11, h: 1,
      fontSize: 16, color: C.purplePale, align: "center", fontFace: "Arial",
    });
  }
  s.addText(`Objective: ${plan.objective}`, {
    x: 1, y: 5, w: 11, h: 0.5,
    fontSize: 12, color: "9F7AEA", align: "center", fontFace: "Arial", italic: true,
  });
  s.addText("Created with s-slide", {
    x: 1, y: 6.5, w: 11, h: 0.4,
    fontSize: 11, color: "9F7AEA", align: "center", fontFace: "Arial",
  });
}
