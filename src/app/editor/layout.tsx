import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "页面编辑 - AI 绘本工作室",
  description: "编辑绘本页面文字样式、布局和插画",
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
