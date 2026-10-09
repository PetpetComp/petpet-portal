"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { SidebarProvider } from "@/components/layouts/sidebar/sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SidebarProvider>
          {children}
          <Toaster richColors position="top-right" />
        </SidebarProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
