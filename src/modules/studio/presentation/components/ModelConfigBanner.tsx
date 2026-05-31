"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface ModelConfigBannerProps {
  missingText?: boolean;
  missingImage?: boolean;
}

export function ModelConfigBanner({ missingText, missingImage }: ModelConfigBannerProps) {
  const parts: string[] = [];
  if (missingText) parts.push("文本模型");
  if (missingImage) parts.push("图像模型");

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span>
        尚未配置{parts.join("和")}，请先前往{" "}
        <Link href="/settings/models" className="font-medium underline hover:text-yellow-900">
          模型设置
        </Link>{" "}
        页面添加模型配置。
      </span>
    </div>
  );
}
