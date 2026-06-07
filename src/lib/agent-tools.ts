import PptxGenJS from "pptxgenjs";

export async function executePptxGenJSCode(code: string): Promise<Buffer> {
  const executeCode = new Function('pptxgenjs', `
    return (async () => {
      ${code}
      return pptxgenjs;
    })();
  `);

  const result = await executeCode(PptxGenJS);

  if (result && typeof result.write === 'function') {
    const buffer = await result.write({ outputType: 'nodebuffer' });
    return Buffer.from(buffer);
  }

  throw new Error('Failed to generate presentation');
}

const COLORS = {
  title: "6B21A8",
  heading: "7C3AED",
  body: "333333",
  subtitle: "888888",
  accent: "A78BFA",
  bg: "F3F0FF",
};

export function generatePresentationCode(
  topic: string,
  slideCount: number = 5,
  slideDetails?: string
): string {
  return `
const pptx = new pptxgenjs();
pptx.author = "s-slide AI";
pptx.company = "s-slide";
pptx.title = "${topic.replace(/"/g, '\\"')}";
pptx.layout = "LAYOUT_WIDE";

${slideDetails ? generateDetailedSlides(slideDetails, topic) : generateDefaultSlides(topic, slideCount)}

return pptx;
  `;
}

function generateDefaultSlides(topic: string, slideCount: number): string {
  const escaped = topic.replace(/"/g, '\\"');
  const slides: string[] = [];

  // Title slide with gradient-like background
  slides.push(`
const s1 = pptx.addSlide();
s1.background = { fill: "F3F0FF" };
s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { type: "solid", color: "6B21A8" } });
s1.addText("${escaped}", {
  x: 0.8, y: 1.8, w: 11.2, h: 2,
  fontSize: 44, bold: true, color: "FFFFFF", align: "center", fontFace: "Arial"
});
s1.addText("Created with s-slide AI", {
  x: 0.8, y: 4, w: 11.2, h: 0.6,
  fontSize: 16, color: "C4B5FD", align: "center", fontFace: "Arial"
});
`);

  // Content slides with real structure
  const sections = getSlideSections(topic, slideCount);
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    slides.push(`
const s${i + 2} = pptx.addSlide();
s${i + 2}.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: "100%", fill: { type: "solid", color: "7C3AED" } });
s${i + 2}.addText("${s.title.replace(/"/g, '\\"')}", {
  x: 0.6, y: 0.4, w: 11.5, h: 0.9,
  fontSize: 28, bold: true, color: "6B21A8", fontFace: "Arial"
});
s${i + 2}.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 2, h: 0.04, fill: { type: "solid", color: "A78BFA" } });
s${i + 2}.addText("${s.content.replace(/"/g, '\\"')}", {
  x: 0.6, y: 1.6, w: 11.5, h: 4,
  fontSize: 16, color: "333333", fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top"
});
`);
  }

  // Closing slide
  slides.push(`
const sLast = pptx.addSlide();
sLast.background = { fill: "F3F0FF" };
sLast.addText("Thank You!", {
  x: 0.8, y: 2, w: 11.2, h: 1.5,
  fontSize: 48, bold: true, color: "6B21A8", align: "center", fontFace: "Arial"
});
sLast.addText("Made with s-slide", {
  x: 0.8, y: 3.8, w: 11.2, h: 0.6,
  fontSize: 16, color: "888888", align: "center", fontFace: "Arial"
});
`);

  return slides.join("\n");
}

function getSlideSections(topic: string, count: number): Array<{ title: string; content: string }> {
  // Generate meaningful section data based on topic
  const t = topic.toLowerCase();
  const sections: Array<{ title: string; content: string }> = [];

  // Generic meaningful content structure
  const introTitle = `What is ${topic}?`;
  const introContent = `${topic} is an important subject worth exploring in detail. This presentation covers the key aspects, history, and future outlook.`;

  sections.push({ title: introTitle, content: introContent });

  if (count >= 3) {
    sections.push({
      title: "Key Points",
      content: getBulletContent(topic),
    });
  }

  if (count >= 4) {
    sections.push({
      title: "Benefits & Impact",
      content: `Understanding ${topic} provides valuable insights for both personal and professional growth. The impact can be seen across multiple domains.`,
    });
  }

  if (count >= 5) {
    sections.push({
      title: "Future Outlook",
      content: `The future of ${topic} looks promising with continued development and innovation. Stay informed and adapt to emerging trends.`,
    });
  }

  // Add extra slides if needed
  while (sections.length < count - 1) {
    const idx = sections.length + 1;
    sections.push({
      title: `Deep Dive ${idx}`,
      content: `An in-depth look at additional aspects of ${topic} and their significance.`,
    });
  }

  // Trim to fit (count - 1 content slides, minus title and closing)
  return sections.slice(0, Math.max(1, count - 2));
}

function getBulletContent(topic: string): string {
  return `• Understanding the fundamentals of ${topic}\n• Exploring real-world applications and use cases\n• Identifying challenges and opportunities\n• Learning best practices and strategies\n• Measuring success and outcomes`;
}

function generateDetailedSlides(slideDetails: string, topic: string): string {
  return `
${slideDetails}

const closingSlide = pptx.addSlide();
closingSlide.background = { fill: "F3F0FF" };
closingSlide.addText("Thank You!", {
  x: 0.8, y: 2, w: 11.2, h: 1.5,
  fontSize: 48, bold: true, color: "6B21A8", align: "center", fontFace: "Arial"
});
`;
}

export function parsePresentationRequest(userMessage: string): {
  topic: string;
  slideCount: number;
  details?: string;
} {
  const slideCountMatch = userMessage.match(/(\d+)\s*slide/i);
  const slideCount = slideCountMatch ? parseInt(slideCountMatch[1]) : 5;

  let topic = userMessage
    .replace(/(\d+)\s*slide[s]?\s*/gi, "")
    .replace(/about\s*/gi, "")
    .replace(/create\s*a?\s*/gi, "")
    .replace(/make\s*a?\s*/gi, "")
    .replace(/presentation\s*/gi, "")
    .trim();

  if (!topic) topic = "My Presentation";
  return { topic, slideCount };
}
