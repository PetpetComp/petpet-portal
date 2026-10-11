"use client";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/** Berlangganan event online/offline browser. Dipanggil oleh useSyncExternalStore. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Status koneksi browser (`navigator.onLine` + event online/offline), temuan D5.
 * Dipanggil dari badge di header dan dari layar Drawing (Lock dan Swap dimatikan saat offline).
 * Di server dianggap online supaya HTML awal sama dengan klien yang online.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Badge koneksi di header Live Mode: titik tenang "Connected" saat online, dan keadaan jelas
 * "Offline - actions will not be sent" saat offline. `role="status"` agar pembaca layar
 * mengumumkan perubahannya.
 */
export function ConnectionBadge() {
  const online = useOnlineStatus();
  if (online)
    return (
      <span
        role="status"
        className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold"
      >
        <span className="bg-success size-2 rounded-full" aria-hidden />
        Connected
      </span>
    );
  return (
    <span
      role="status"
      className="bg-danger-soft text-danger-ink flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
    >
      <WifiOff size={14} aria-hidden />
      Offline - actions will not be sent
    </span>
  );
}
