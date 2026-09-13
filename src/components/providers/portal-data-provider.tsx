"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Collection, PortalData, PortalRecord } from "@/types/portal";

interface PortalContextValue {
  data: PortalData;
  save: (collection: Collection, record: PortalRecord) => void;
  remove: (collection: Collection, id: string) => void;
}
const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalDataProvider({
  initialData,
  children,
}: {
  initialData: PortalData;
  children: ReactNode;
}) {
  const [data, setData] = useState(initialData);
  function save(collection: Collection, record: PortalRecord) {
    setData((current) => ({
      ...current,
      [collection]: current[collection].some((item) => item.id === record.id)
        ? current[collection].map((item) =>
            item.id === record.id ? record : item,
          )
        : [...current[collection], record],
    }));
  }
  function remove(collection: Collection, id: string) {
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  }
  return (
    <PortalContext.Provider value={{ data, save, remove }}>
      {children}
    </PortalContext.Provider>
  );
}
export function usePortalData() {
  const context = useContext(PortalContext);
  if (!context) throw new Error("PortalDataProvider is required");
  return context;
}
