"use client";

import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/layouts/sidebar/sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {children}
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
