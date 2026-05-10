import { NextRequest, NextResponse } from "next/server";
import { getImageModelFactory } from "@/platform/ai/registry/model-factory";
import { ensureModelsInitialized } from "@/platform/ai/registry/model-init";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    ensureModelsInitialized();

    const body = await request.json();
    const { alias, payload } = body;

    if (!alias || !payload) {
      return NextResponse.json(
        { success: false, error: { code: "PARAM_INVALID", message: "alias and payload are required" } },
        { status: 400 }
      );
    }

    const factory = getImageModelFactory();
    const strategy = factory.get(alias);

    const result = await strategy.generate({
      prompt: payload.prompt,
      negativePrompt: payload.negativePrompt,
      size: payload.size,
      quality: payload.quality,
      style: payload.style,
      seed: payload.seed,
      headers: payload.headers,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
