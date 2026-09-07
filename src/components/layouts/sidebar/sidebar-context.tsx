"use client";

import { createContext, useContext, useState } from "react";

type SidebarContextValue = {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error("useSidebarContext must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isMobile: false,
        setIsOpen,
        toggleSidebar: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
