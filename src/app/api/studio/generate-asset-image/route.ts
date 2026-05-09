import { NextRequest, NextResponse } from "next/server";
import { generateAssetImage } from "@/server/services/generate-service";
import type { AssetItem, ProjectInfo } from "@/types/picturebook";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const asset = body.asset as AssetItem | undefined;
    const projectInfo = body.projectInfo as ProjectInfo | undefined;

    if (!asset || !projectInfo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 asset 或 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generateAssetImage(asset, projectInfo);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
