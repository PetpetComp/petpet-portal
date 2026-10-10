import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";

export const countUsers = () => countAt(ENDPOINTS.users.list);
