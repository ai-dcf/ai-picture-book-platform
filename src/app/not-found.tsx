import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="font-display text-2xl text-foreground">页面未找到</h2>
      <p className="text-muted-foreground font-body text-sm">你访问的页面不存在或已被移除。</p>
      <Link
        href="/"
        className="text-primary font-body text-sm underline underline-offset-4 hover:text-primary/80"
      >
        返回首页
      </Link>
    </div>
  );
}
