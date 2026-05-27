import { NextRequest, NextResponse } from "next/server";
import { generateStoryPack } from "@/modules/studio/application/use-cases/generate-story-pack";
import type { ProjectInfo } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectInfo = body.projectInfo as ProjectInfo | undefined;
    const userIdea = String(body.userIdea || "");

    if (!projectInfo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generateStoryPack(projectInfo, userIdea);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

