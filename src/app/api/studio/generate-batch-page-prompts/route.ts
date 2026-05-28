import { NextRequest, NextResponse } from "next/server";
import { generateBatchPagePrompts } from "@/modules/studio/application/use-cases/generate-batch-page-prompts";
import type { AssetsData, PageItem, ProjectInfo, StoryboardPageData } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pages = Array.isArray(body.pages)
      ? (body.pages as Array<Pick<PageItem, "index" | "storyText" | "pageText" | "visualGoal" | "aspectRatio">>)
      : [];
    const storyboardPages = Array.isArray(body.storyboardPages)
      ? (body.storyboardPages as StoryboardPageData[])
      : undefined;
    const assets = body.assets as AssetsData | undefined;
    const projectInfo = body.projectInfo as ProjectInfo | undefined;

    if (!assets || !projectInfo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 assets 或 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generateBatchPagePrompts(pages, assets, projectInfo, storyboardPages);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

