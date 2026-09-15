"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Collection, PortalData, PortalRecord } from "@/types/portal";
import {
  deleteRecord,
  emptyPortalData,
  loadPortalData,
  saveRecord,
} from "@/services/backend-records";
import { Button } from "@/components/ui/button";
interface PortalContextValue {
  data: PortalData;
  errors: Partial<Record<Collection, string>>;
  refresh: () => Promise<void>;
  save: (collection: Collection, record: PortalRecord) => Promise<PortalRecord>;
  remove: (collection: Collection, id: string) => Promise<void>;
}
const PortalContext = createContext<PortalContextValue | null>(null);
export function PortalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData>(emptyPortalData);
  const [errors, setErrors] = useState<PortalContextValue["errors"]>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadPortalData();
      setData(result.data);
      setErrors(result.errors);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load portal data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    loadPortalData()
      .then((result) => {
        if (active) {
          setData(result.data);
          setErrors(result.errors);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load portal data.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(collection: Collection, record: PortalRecord) {
    const saved = await saveRecord(
      collection,
      record,
      data[collection].some((item) => item.id === record.id),
    );
    setData((current) => ({
      ...current,
      [collection]: current[collection].some((item) => item.id === saved.id)
        ? current[collection].map((item) =>
            item.id === saved.id ? saved : item,
          )
        : [...current[collection], saved],
    }));
    return saved;
  }
  async function remove(collection: Collection, id: string) {
    const record = data[collection].find((item) => item.id === id);
    if (!record) throw new Error("Record not found.");
    await deleteRecord(collection, record);
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  }
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <p role="status">Loading your portal...</p>
      </main>
    );
  if (error)
    return (
      <main className="grid min-h-screen place-content-center gap-4 p-8">
        <p role="alert">{error}</p>
        <Button onClick={() => void refresh()}>Try again</Button>
      </main>
    );
  return (
    <PortalContext.Provider value={{ data, errors, refresh, save, remove }}>
      {children}
    </PortalContext.Provider>
  );
}
export function usePortalData() {
  const context = useContext(PortalContext);
  if (!context) throw new Error("PortalDataProvider is required");
  return context;
}
