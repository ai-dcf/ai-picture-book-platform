import { NextRequest, NextResponse } from "next/server";
import { generateStoryboard } from "@/modules/studio/application/use-cases/generate-storyboard";
import type { ProjectInfo, StoryData } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const story = body.story as StoryData | undefined;
    const projectInfo = body.projectInfo as ProjectInfo | undefined;

    if (!story || !projectInfo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 story 或 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generateStoryboard(story, projectInfo);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
