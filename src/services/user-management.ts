import type { ApiResponse, Paginated } from "@/types/common";
import type { User } from "@/types/user";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockUsers } from "@/lib/mocks/users";
import { delay, ok, paginate } from "@/services/common";

export const userService = {
  list: (): Promise<Paginated<User>> =>
    // return apiClient.get<Paginated<User>>(ENDPOINTS.users.list);
    delay(paginate(mockUsers)),

  detail: (id: string): Promise<ApiResponse<User>> => {
    // return apiClient.get<ApiResponse<User>>(ENDPOINTS.users.detail(id));
    const user = mockUsers.find((u) => u.id === id) ?? mockUsers[0];
    return delay(ok(user));
  },
};
