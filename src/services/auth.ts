import { apiClient, uploadToPresignedUrl } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { LoginResponse, MeResponse, SignUpPayload } from "@/types/auth";
import type {
  MutationResponse,
  ListResponse,
  PhotoPresignResponse,
} from "@/types/api";
export const AUTH_SERVICES = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>(ENDPOINTS.auth.login, { email, password }),
  register: (payload: SignUpPayload) =>
    apiClient.post<LoginResponse>(ENDPOINTS.auth.register, { ...payload }),
  ssoExchange: (ssoToken: string) =>
    apiClient.post<LoginResponse>(ENDPOINTS.auth.sso, { sso_token: ssoToken }),
  me: () => apiClient.get<MeResponse>(ENDPOINTS.auth.me),
  uploadMyPhoto: async (file: File) => {
    const presigned = await apiClient.post<PhotoPresignResponse>(
      ENDPOINTS.auth.mePhotoPresign,
      { filename: file.name, content_type: file.type },
    );
    await uploadToPresignedUrl(
      presigned.data.upload_url,
      presigned.data.headers,
      file,
    );
    return presigned.data.photo_url;
  },
  logout: () => apiClient.post<MutationResponse>(ENDPOINTS.auth.logout),
  roles: () => apiClient.get<ListResponse>(ENDPOINTS.auth.roles),
  permissions: () => apiClient.get<ListResponse>(ENDPOINTS.auth.permissions),
};
