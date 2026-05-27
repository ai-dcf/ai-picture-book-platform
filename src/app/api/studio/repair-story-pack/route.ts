import { NextRequest, NextResponse } from "next/server";
import { repairStoryPack } from "@/modules/studio/application/use-cases/repair-story-pack";
import type { StoryPackCheckReport } from "@/prompts/builders/story-pack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userIdea = String(body.userIdea || "");
    const originalJson = String(body.originalJson || "");
    const checkReport = body.checkReport as StoryPackCheckReport | undefined;

    if (!userIdea || !originalJson || !checkReport) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 userIdea、originalJson 或 checkReport 参数" } },
        { status: 400 }
      );
    }

    const result = await repairStoryPack(userIdea, originalJson, checkReport);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

