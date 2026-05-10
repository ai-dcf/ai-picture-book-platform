"use client";

import { AppQueryProvider } from "@/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudioProvider } from "@/modules/studio/presentation/context/StudioContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppQueryProvider>
      <TooltipProvider>
        <StudioProvider>
          {children}
          <Toaster />
          <Sonner />
        </StudioProvider>
      </TooltipProvider>
    </AppQueryProvider>
  );
}
