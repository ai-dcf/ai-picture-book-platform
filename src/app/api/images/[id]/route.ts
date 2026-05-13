import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const returnFormat = searchParams.get("format") || "json";

    const db = getDb();

    const version = db.prepare(`
      SELECT iv.*, p.user_id
      FROM image_versions iv
      JOIN pages pg ON iv.owner_id = pg.id
      JOIN projects p ON pg.project_id = p.id
      WHERE iv.id = ? AND p.user_id = ?
    `).get(id, session.user.id) as {
      id: string;
      owner_type: string;
      owner_id: string;
      version_number: number;
      image_blob: Buffer | null;
      image_url: string | null;
      description: string | null;
      description_edited: number;
      created_at: number;
      user_id: string;
    } | undefined;

    if (!version) {
      const page = db.prepare(`
        SELECT p.*, pr.user_id
        FROM pages p
        JOIN projects pr ON p.project_id = pr.id
        WHERE p.id = ? AND pr.user_id = ?
      `).get(id, session.user.id) as {
        id: string;
        project_id: string;
        page_index: number;
        image_blob: Buffer | null;
        image_url: string | null;
        user_id: string;
      } | undefined;

      if (!page) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "图片不存在或无权限访问" } },
          { status: 404 }
        );
      }

      if (returnFormat === "blob" && page.image_blob) {
        return new NextResponse(new Uint8Array(page.image_blob), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: page.id,
          type: "page",
          imageUrl: page.image_url,
          hasBlob: !!page.image_blob,
          pageIndex: page.page_index,
        },
      });
    }

    if (returnFormat === "blob" && version.image_blob) {
      return new NextResponse(new Uint8Array(version.image_blob), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: version.id,
        type: version.owner_type,
        ownerId: version.owner_id,
        versionNumber: version.version_number,
        imageUrl: version.image_url,
        hasBlob: !!version.image_blob,
        description: version.description,
        descriptionEdited: !!version.description_edited,
        createdAt: version.created_at,
      },
    });
  } catch (err) {
    console.error("[API/获取图片] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
