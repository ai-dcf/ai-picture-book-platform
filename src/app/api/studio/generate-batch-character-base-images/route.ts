import { NextRequest, NextResponse } from "next/server";
import { generateBatchCharacterBaseImages } from "@/modules/studio/application/use-cases/generate-batch-character-base-images";
import type { AssetItem, ProjectInfo } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const assets = Array.isArray(body.assets) ? (body.assets as AssetItem[]) : [];
    const projectInfo = body.projectInfo as ProjectInfo | undefined;

    if (!projectInfo) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 projectInfo 参数" } },
        { status: 400 }
      );
    }

    const result = await generateBatchCharacterBaseImages(assets, projectInfo);
    const status = result.success ? 200 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

