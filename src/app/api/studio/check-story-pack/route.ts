import { NextRequest, NextResponse } from "next/server";
import { checkStoryPack } from "@/modules/studio/application/use-cases/check-story-pack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userIdea = String(body.userIdea || "");
    const generatedJson = String(body.generatedJson || "");

    if (!userIdea || !generatedJson) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 userIdea 或 generatedJson 参数" } },
        { status: 400 }
      );
    }

    const result = await checkStoryPack(userIdea, generatedJson);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

