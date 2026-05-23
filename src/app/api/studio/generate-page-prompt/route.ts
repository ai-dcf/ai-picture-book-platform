import { NextRequest, NextResponse } from "next/server";
import { generatePagePrompt } from "@/modules/studio/application/use-cases/generate-page-prompt";
import type { AssetsData, PageItem, ProjectInfo, StoryboardPageData } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const page = body.page as PageItem | undefined;
    const projectInfo = body.projectInfo as ProjectInfo | undefined;
    const assets = body.assets as AssetsData | undefined;
    const storyboardPage = body.storyboardPage as StoryboardPageData | undefined;

    if (!page || !projectInfo || !assets) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 page、assets 或 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generatePagePrompt(page, assets, projectInfo, storyboardPage);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
