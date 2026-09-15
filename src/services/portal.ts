import { loadPortalData } from "./backend-records";
export async function getPortalData() {
  const result = await loadPortalData();
  if (Object.keys(result.errors).length)
    throw new Error(
      Object.entries(result.errors)
        .map(([collection, message]) => collection + ": " + message)
        .join("; "),
    );
  return result.data;
}
