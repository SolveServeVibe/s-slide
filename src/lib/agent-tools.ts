import PptxGenJS from "pptxgenjs";

export async function executePptxGenJSCode(code: string): Promise<Buffer> {
  try {
    // Create an async function that takes pptxgenjs as a parameter
    const executeCode = new Function('pptxgenjs', `
      return (async () => {
        ${code}
        // The code should create a pptx instance and we'll capture it
        return pptxgenjs;
      })();
    `);

    // Execute the code to get the pptx instance
    const result = await executeCode(PptxGenJS);

    // If the result is a PptxGenJS instance, generate the buffer
    if (result && typeof result.write === 'function') {
      const buffer = await result.write({ outputType: 'nodebuffer' });
      return Buffer.from(buffer);
    }

    throw new Error('Failed to generate presentation - invalid pptx instance');
  } catch (error) {
    console.error("Code execution failed:", error);
    throw new Error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function generatePresentationCode(
  topic: string,
  slideCount: number = 5,
  slideDetails?: string
): string {
  return `
// Create a new presentation
const pptx = new pptxgen();

// Set presentation metadata
pptx.author = "s-slide AI";
pptx.company = "s-slide";
pptx.title = "${topic.replace(/"/g, '\\"')}";

${slideDetails ? generateDetailedSlides(slideDetails, topic) : generateDefaultSlides(topic, slideCount)}

// Generate and return the presentation
pptx.write().then(fileName => {
  console.log("Presentation created:", fileName);
});
  `;
}

function generateDefaultSlides(topic: string, slideCount: number): string {
  const slides: string[] = [];

  slides.push(`
// Title Slide
const slide1 = pptx.addSlide();
slide1.addText("${topic.replace(/"/g, '\\"')}", {
  x: 1,
  y: 1.5,
  w: 8,
  h: 1.5,
  fontSize: 44,
  bold: true,
  color: "6B21A8",
  align: "center"
});
slide1.addText("Created with AI", {
  x: 1,
  y: 3.5,
  w: 8,
  h: 0.5,
  fontSize: 18,
  color: "888888",
  align: "center"
});
  `);

  for (let i = 2; i <= slideCount; i++) {
    slides.push(`
// Slide ${i}
const slide${i} = pptx.addSlide();
slide${i}.addText("Section ${i - 1}: ${topic.replace(/"/g, '\\"')}", {
  x: 0.5,
  y: 0.5,
  w: 9,
  h: 1,
  fontSize: 32,
  bold: true,
  color: "7C3AED"
});
slide${i}.addText("Key points will be added here based on your topic.", {
  x: 0.5,
  y: 2,
  w: 9,
  h: 3,
  fontSize: 18,
  color: "333333"
});
    `);
  }

  return slides.join("\n");
}

function generateDetailedSlides(slideDetails: string, topic: string): string {
  return `
// Parse and create custom slides based on detailed requirements
${slideDetails}

// Add a closing slide
const closingSlide = pptx.addSlide();
closingSlide.addText("Thank You", {
  x: 1,
  y: 2,
  w: 8,
  h: 1.5,
  fontSize: 44,
  bold: true,
  color: "6B21A8",
  align: "center"
});
  `;
}

export function parsePresentationRequest(userMessage: string): {
  topic: string;
  slideCount: number;
  details?: string;
} {
  const lowerMessage = userMessage.toLowerCase();

  const slideCountMatch = userMessage.match(/(\d+)\s*slide/i);
  const slideCount = slideCountMatch ? parseInt(slideCountMatch[1]) : 5;

  let topic = userMessage
    .replace(/(\d+)\s*slide[s]?\s*/gi, "")
    .replace(/about\s*/gi, "")
    .replace(/create\s*a?\s*/gi, "")
    .replace(/make\s*a?\s*/gi, "")
    .replace(/presentation\s*/gi, "")
    .trim();

  if (!topic) {
    topic = "My Presentation";
  }

  return { topic, slideCount };
}
