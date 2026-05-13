"use client";

import { useSearchParams } from "next/navigation";
import { StudioProvider } from "@/modules/studio/presentation/context/StudioContext";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return (
    <StudioProvider projectId={projectId}>
      {children}
    </StudioProvider>
  );
}
