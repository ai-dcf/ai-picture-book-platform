import { NextRequest, NextResponse } from "next/server";
import { getTextModelFactory } from "@/platform/ai/registry/model-factory";
import { ensureModelsInitialized } from "@/platform/ai/registry/model-init";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  ensureModelsInitialized();

  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const { alias, payload } = body;

    if (!alias || !payload) {
      return NextResponse.json(
        { success: false, error: { code: "PARAM_INVALID", message: "alias and payload are required" } },
        { status: 400 }
      );
    }

    const factory = getTextModelFactory();
    const strategy = factory.get(alias);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await strategy.generateStream(
            {
              prompt: payload.prompt,
              systemPrompt: payload.systemPrompt,
              messages: payload.messages,
              temperature: payload.temperature,
              maxTokens: payload.maxTokens,
              headers: payload.headers,
            },
            (chunk) => {
              const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            }
          );

          const finalEvent = `data: ${JSON.stringify({ type: "done", result })}\n\n`;
          controller.enqueue(encoder.encode(finalEvent));
          controller.close();
        } catch (err: any) {
          const errorEvent = `data: ${JSON.stringify({ type: "error", error: { message: err.message ?? "Stream error" } })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
