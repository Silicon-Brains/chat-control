import { api } from './client';
import type {
  AdminUser,
  AdminStats,
  AuditEntry,
  Conversation,
  ConversationType,
  DirectoryUser,
  EncryptedMessage,
  Page,
  User,
} from '@/types';

export interface LoginResponse {
  accessToken: string;
  user: User;
  needsKeySetup?: boolean;
}

export const authApi = {
  login: (body: { username: string; code: string }) =>
    api<LoginResponse>('/auth/login', { method: 'POST', body, auth: false }),
  adminLogin: (body: { username: string; adminCode: string; totp: string }) =>
    api<LoginResponse>('/admin/auth/login', { method: 'POST', body, auth: false }),
  logout: () => api('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  me: () => api<User>('/users/me'),
  directory: async () => {
    const result = await api<Page<DirectoryUser> | DirectoryUser[]>('/users');
    return Array.isArray(result) ? result : result.items ?? [];
  },
  registerKey: (publicKey: string) => api('/users/me/key', { method: 'PUT', body: { publicKey } }),
  resetKey: (publicKey: string) => api('/users/me/key/reset', { method: 'POST', body: { publicKey } }),
};

export interface CreateConversationBody {
  type: ConversationType;
  name?: string;
  members: { userId: string; wrappedKey: string; wrapperPub: string }[];
}

export const conversationsApi = {
  list: () => api<Conversation[]>('/conversations'),
  get: (id: string) => api<Conversation>(`/conversations/${id}`),
  create: (body: CreateConversationBody) =>
    api<{ id: string; currentKeyVersion: number }>('/conversations', { method: 'POST', body }),
  updateGroup: (id: string, body: { name?: string; groupIcon?: string | null }) =>
    api<Conversation>(`/conversations/${id}`, { method: 'PATCH', body }),
  deleteGroup: (id: string) => api(`/conversations/${id}`, { method: 'DELETE' }),
  messages: (id: string, cursor?: string | null, signal?: AbortSignal) =>
    api<Page<EncryptedMessage>>(`/conversations/${id}/messages`, {
      query: { cursor: cursor ?? undefined },
      signal,
    }),
  messageUpdates: (id: string, after?: string | null, signal?: AbortSignal) =>
    api<EncryptedMessage[]>(`/conversations/${id}/messages/updates`, { query: { after: after ?? undefined }, signal }),
  markRead: (id: string) => api(`/conversations/${id}/read`, { method: 'POST' }),
  sendMessage: (id: string, body: { id: string; ciphertext: string; nonce: string; keyVersion: number }) =>
    api<EncryptedMessage>(`/conversations/${id}/messages`, { method: 'POST', body }),
  editMessage: (id: string, messageId: string, body: { ciphertext: string; nonce: string; keyVersion: number }) =>
    api<EncryptedMessage>(`/conversations/${id}/messages/${messageId}`, { method: 'PUT', body }),
  deleteMessage: (id: string, messageId: string) =>
    api<EncryptedMessage>(`/conversations/${id}/messages/${messageId}`, { method: 'DELETE' }),
};

export interface CreatedUser {
  id: string;
  username: string;
  loginCode: string;
}

export const adminApi = {
  users: (cursor?: string | null) =>
    api<Page<AdminUser> | AdminUser[]>('/admin/users', { query: { limit: 100, cursor: cursor ?? undefined } }),
  stats: () => api<AdminStats>('/admin/stats'),
  approveUser: (id: string) => api<AdminUser>(`/admin/users/${id}/approve`, { method: 'POST' }),
  resetKey: (id: string) => api(`/admin/users/${id}/reset-key`, { method: 'POST' }),
  createUser: (body: { username: string; displayName: string }) =>
    api<CreatedUser>('/admin/users', { method: 'POST', body }),
  resetCode: (id: string) => api<{ loginCode: string }>(`/admin/users/${id}/reset-code`, { method: 'POST' }),
  setStatus: (id: string, status: 'active' | 'disabled') =>
    api(`/admin/users/${id}`, { method: 'PATCH', body: { status } }),
  updateUser: (id: string, body: { role?: 'admin' | 'user'; managementVerified?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
  audit: (cursor?: string | null) =>
    api<Page<AuditEntry>>('/admin/audit', { query: { cursor: cursor ?? undefined } }),
};
