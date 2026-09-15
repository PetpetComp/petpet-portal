"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/layouts/sidebar/sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        {children}
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </AuthProvider>
  );
}
