import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateObject } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { presentationSchema, buildPptx } from "@/lib/presentation";
import type { z } from "zod";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { message } = await req.json();

  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  const { object: plan } = await generateObject({
    model: bedrock("global.anthropic.claude-sonnet-4-6"),
    schema: presentationSchema,
    prompt: `You are a presentation design expert. Create a professional presentation plan for: "${message}"

Follow this methodology strictly:

1. FIRST: Define audience, setting (live), and objective
2. Find the FIRE: What burning problem hooks the audience? Open with a shocking statistic, counterintuitive fact, or urgent problem.
3. Use CLAIM+PROOF model: Each claim slide states one clear point. Follow claims with proof slides showing data/evidence.
4. STRUCTURE: title → fire (the hook) → claim/proof pairs → closing
5. ONE MESSAGE PER SLIDE: Each slide headline is one single point. Keep bullets to 3-5 max.
6. Use REAL facts, data, and specific insights. No generic filler.
7. Cite sources where applicable.
8. The closing slide should reinforce the objective and include a call to action.

DIAGRAMS: When a proof slide would benefit from a visual diagram (flowchart, architecture, timeline, org chart, comparison, etc.), include a Mermaid.js diagram in the image.mermaid field. Use these Mermaid diagram types:
- flowchart TD / LR for processes and architectures
- sequenceDiagram for interactions
- gantt for timelines
- pie for distributions
- graph for relationships

Slide types:
- "title": Opening slide with presentation title
- "fire": The hook - shocking stat, urgent problem, counterintuitive fact (dark background)
- "claim": A bold statement/argument (purple accent bar, white bg)
- "proof": Data/evidence supporting a claim (light purple bg) - USE MERmaid DIAGRAMS HERE
- "closing": Summary + call to action (purple bg)`,
  });

  // Build PPTX (async for mermaid rendering)
  const pptx = await buildPptx(plan as z.infer<typeof presentationSchema>);

  const publicDir = join(process.cwd(), "public", "presentations");
  await mkdir(publicDir, { recursive: true });
  const filename = `presentation-${randomUUID()}.pptx`;
  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  await writeFile(join(publicDir, filename), buffer);

  return NextResponse.json({
    success: true,
    downloadUrl: `/api/presentations/${filename}`,
    filename,
    slides: plan.slides,
    title: plan.slides[0]?.headline ?? "Presentation",
    plan: { audience: plan.audience, objective: plan.objective, fire: plan.fire },
  });
}
