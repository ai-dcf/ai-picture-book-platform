import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "ark-acg-cn-beijing.tos-cn-beijing.volces.com",
]);

function isAllowedRemoteUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    const remote = request.nextUrl.searchParams.get("url") || "";
    const remoteUrl = isAllowedRemoteUrl(remote);
    if (!remoteUrl) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_URL", message: "图片地址无效或不受支持" } },
        { status: 400 }
      );
    }

    const upstream = await fetch(remoteUrl, {
      cache: "force-cache",
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: { code: "FETCH_FAILED", message: "远程图片获取失败" } },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CONTENT_TYPE", message: "远程资源不是图片" } },
        { status: 415 }
      );
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[API/图片代理] 异常:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}
