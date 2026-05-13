import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { get_default_text_strategy } from "@/modules/studio/application/use-cases/_helpers";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const description = body.description as string | undefined;

    if (description === undefined) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 description 参数" } },
        { status: 400 }
      );
    }

    const db = getDb();

    const version = db.prepare(`
      SELECT iv.*, p.user_id
      FROM image_versions iv
      JOIN pages pg ON iv.owner_id = pg.id
      JOIN projects p ON pg.project_id = p.id
      WHERE iv.id = ? AND p.user_id = ?
    `).get(id, session.user.id) as { id: string; description: string | null; description_edited: number } | undefined;

    if (!version) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "图片版本不存在或无权限访问" } },
        { status: 404 }
      );
    }

    db.prepare(`
      UPDATE image_versions
      SET description = ?, description_edited = 1
      WHERE id = ?
    `).run(description, id);

    return NextResponse.json({
      success: true,
      data: {
        id,
        description,
        descriptionEdited: true,
      },
    });
  } catch (err) {
    console.error("[API/更新图片描述] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const db = getDb();

    const version = db.prepare(`
      SELECT iv.*, p.user_id, pg.project_id
      FROM image_versions iv
      JOIN pages pg ON iv.owner_id = pg.id
      JOIN projects p ON pg.project_id = p.id
      WHERE iv.id = ? AND p.user_id = ?
    `).get(id, session.user.id) as {
      id: string;
      image_url: string | null;
      description: string | null;
      owner_id: string;
      project_id: string;
    } | undefined;

    if (!version) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "图片版本不存在或无权限访问" } },
        { status: 404 }
      );
    }

    const strategy = get_default_text_strategy();
    if (!strategy) {
      return NextResponse.json(
        { success: false, error: { code: "NO_MODEL_CONFIGURED", message: "未配置文本模型，无法生成描述" } },
        { status: 422 }
      );
    }

    const systemPrompt = "你是一个专业的绘本图片描述专家。请根据图片生成一段简洁、准确的描述，用于帮助用户理解图片内容。描述应该客观、具体，长度控制在100字以内。";
    const userPrompt = version.image_url
      ? `请描述这张图片：${version.image_url}`
      : "请根据图片内容生成一段描述。";

    const result = await strategy.generate({
      prompt: userPrompt,
      systemPrompt,
    });

    if (!result.success || !result.text) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: result.error?.message || "生成描述失败" } },
        { status: 422 }
      );
    }

    const generatedDescription = result.text.trim();

    db.prepare(`
      UPDATE image_versions
      SET description = ?, description_edited = 0
      WHERE id = ?
    `).run(generatedDescription, id);

    return NextResponse.json({
      success: true,
      data: {
        id,
        description: generatedDescription,
        descriptionEdited: false,
      },
    });
  } catch (err) {
    console.error("[API/生成图片描述] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
