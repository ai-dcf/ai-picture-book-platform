"use client";

import { AppQueryProvider } from "@/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { NextAuthSessionProvider } from "@/providers/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppQueryProvider>
      <NextAuthSessionProvider>
        <TooltipProvider>
          {children}
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </NextAuthSessionProvider>
    </AppQueryProvider>
  );
}
