import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

interface ImageReference {
  imageId: string;
  referenceText: string;
  position: number;
  ownerType: string;
  ownerId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const text = body.text as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少有效的 text 参数" } },
        { status: 400 }
      );
    }

    const db = getDb();

    if (projectId) {
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, session.user.id);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "项目不存在或无权限访问" } },
          { status: 404 }
        );
      }
    }

    const imageIdPattern = /\[\[image:([a-f0-9-]{36})\]\]/g;
    const references: ImageReference[] = [];

    let match;
    while ((match = imageIdPattern.exec(text)) !== null) {
      const imageId = match[1];
      const position = match.index;

      let ownerInfo: { owner_type: string; owner_id: string } | undefined;
      
      const version = db.prepare(`
        SELECT iv.owner_type, iv.owner_id
        FROM image_versions iv
        JOIN pages pg ON iv.owner_id = pg.id
        JOIN projects p ON pg.project_id = p.id
        WHERE iv.id = ? AND p.user_id = ?
      `).get(imageId, session.user.id) as { owner_type: string; owner_id: string } | undefined;

      if (version) {
        ownerInfo = version;
      } else {
        const page = db.prepare(`
          SELECT p.id as owner_id, 'page' as owner_type
          FROM pages p
          JOIN projects pr ON p.project_id = pr.id
          WHERE p.id = ? AND pr.user_id = ?
        `).get(imageId, session.user.id) as { owner_type: string; owner_id: string } | undefined;

        if (page) {
          ownerInfo = page;
        }
      }

      references.push({
        imageId,
        referenceText: match[0],
        position,
        ownerType: ownerInfo?.owner_type || "unknown",
        ownerId: ownerInfo?.owner_id || "",
      });
    }

    const pageIndexPattern = /\[\[page:(\d+)\]\]/g;
    while ((match = pageIndexPattern.exec(text)) !== null) {
      const pageNum = parseInt(match[1], 10);
      const position = match.index;

      let ownerId = "";
      let ownerType = "page";

      if (projectId) {
        const page = db.prepare(`
          SELECT p.id as owner_id, 'page' as owner_type
          FROM pages p
          JOIN projects pr ON p.project_id = pr.id
          WHERE p.project_id = ? AND p.page_index = ?
        `).get(projectId, pageNum) as { owner_type: string; owner_id: string } | undefined;

        if (page) {
          ownerId = page.owner_id;
          ownerType = page.owner_type;
        }
      }

      references.push({
        imageId: `page_${pageNum}`,
        referenceText: match[0],
        position,
        ownerType,
        ownerId,
      });
    }

    references.sort((a, b) => a.position - b.position);

    return NextResponse.json({
      success: true,
      data: {
        references,
        totalCount: references.length,
      },
    });
  } catch (err) {
    console.error("[API/解析图片引用] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
