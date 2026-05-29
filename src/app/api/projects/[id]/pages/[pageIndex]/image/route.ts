import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageIndex: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    const { id: projectId, pageIndex: pageIndexStr } = await params;
    const pageIndex = parseInt(pageIndexStr, 10);

    if (isNaN(pageIndex) || pageIndex < 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PARAMS", message: "无效的页面索引" } },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const imageUrl = formData.get("imageUrl") as string | null;
    const description = formData.get("description") as string | null;

    if (!image && !imageUrl) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "必须提供图片文件或图片 URL" } },
        { status: 400 }
      );
    }

    const db = getDb();
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, session.user.id) as { id: string } | undefined;

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "项目不存在或无权限访问" } },
        { status: 404 }
      );
    }

    let page = db.prepare("SELECT id, image_blob FROM pages WHERE project_id = ? AND page_index = ?").get(projectId, pageIndex) as { id: string; image_blob: Buffer | null } | undefined;

    const pageId = page?.id || uuidv4();
    const imageBlob = image ? Buffer.from(await image.arrayBuffer()) : null;

    const versionId = uuidv4();
    const currentTimestamp = Date.now();

    if (page) {
      const lastVersion = db.prepare(
        "SELECT MAX(version_number) as max_version FROM image_versions WHERE owner_type = 'page' AND owner_id = ?"
      ).get(pageId) as { max_version: number | null } | undefined;

      const nextVersion = (lastVersion?.max_version ?? 0) + 1;

      db.prepare(`
        INSERT INTO image_versions (id, owner_type, owner_id, version_number, image_blob, image_url, description, description_edited, created_at)
        VALUES (?, 'page', ?, ?, ?, ?, ?, ?, ?)
      `).run(versionId, pageId, nextVersion, imageBlob, imageUrl || null, description || null, description ? 1 : 0, currentTimestamp);

      if (imageBlob) {
        db.prepare("UPDATE pages SET image_blob = ?, image_url = ?, updated_at = ? WHERE id = ?")
          .run(imageBlob, imageUrl || null, currentTimestamp, pageId);
      } else if (imageUrl) {
        db.prepare("UPDATE pages SET image_url = ?, updated_at = ? WHERE id = ?")
          .run(imageUrl, currentTimestamp, pageId);
      }
    } else {
      db.prepare(`
        INSERT INTO pages (id, project_id, page_index, story_text, character_refs, scene_refs, prompt, prompt_user_edited, image_blob, image_url, page_status, generating, created_at, updated_at)
        VALUES (?, ?, ?, '', '[]', '[]', '', 0, ?, ?, 'generated', 0, ?, ?)
      `).run(pageId, projectId, pageIndex, imageBlob, imageUrl || null, currentTimestamp, currentTimestamp);

      db.prepare(`
        INSERT INTO image_versions (id, owner_type, owner_id, version_number, image_blob, image_url, description, description_edited, created_at)
        VALUES (?, 'page', ?, 1, ?, ?, ?, ?, ?)
      `).run(versionId, pageId, imageBlob, imageUrl || null, description || null, description ? 1 : 0, currentTimestamp);
    }

    let versionNumber = 1;
    if (page) {
      const versionRow = db.prepare("SELECT version_number FROM image_versions WHERE id = ?").get(versionId) as { version_number: number } | undefined;
      versionNumber = versionRow?.version_number ?? 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        pageId,
        versionId,
        versionNumber,
        imageUrl: imageUrl || null,
      },
    });
  } catch (err) {
    console.error("[API/上传页面图片] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
