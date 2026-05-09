"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "16px",
          padding: "32px",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#fdf8f0",
          color: "#2d1f14",
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: 600 }}>应用程序发生了严重错误</h2>
          <p style={{ fontSize: "14px", color: "#6b5c4d", textAlign: "center", maxWidth: "400px" }}>
            很抱歉，应用程序遇到了无法恢复的错误。请刷新页面重试。
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 24px",
              borderRadius: "8px",
              backgroundColor: "#c2572a",
              color: "#fff",
              border: "none",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}
