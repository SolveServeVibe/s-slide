import { executePptxGenJSCode, generatePresentationCode, parsePresentationRequest } from "@/lib/agent-tools";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // Parse the user's request
    const request = parsePresentationRequest(message);

    // Generate the PptxGenJS code
    const code = generatePresentationCode(request.topic, request.slideCount, request.details);

    // Execute the code
    const buffer = await executePptxGenJSCode(code);

    // Ensure presentations directory exists
    const publicDir = join(process.cwd(), "public", "presentations");
    await mkdir(publicDir, { recursive: true });

    // Save with unique filename
    const filename = `presentation-${randomUUID()}.pptx`;
    const filepath = join(publicDir, filename);
    await writeFile(filepath, buffer);

    // Return download URL
    return NextResponse.json({
      success: true,
      downloadUrl: `/presentations/${filename}`,
      filename,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate presentation" },
      { status: 500 }
    );
  }
}
