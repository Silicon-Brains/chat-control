import { api } from './client';
import type {
  AdminUser,
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
  wsTicket: () => api<{ ticket: string }>('/auth/ws-ticket', { method: 'POST' }),
};

export const usersApi = {
  directory: () => api<DirectoryUser[]>('/users'),
  registerKey: (publicKey: string) => api('/users/me/key', { method: 'PUT', body: { publicKey } }),
};

export interface CreateConversationBody {
  type: ConversationType;
  name?: string;
  members: { userId: string; wrappedKey: string; wrapperPub: string }[];
}

export const conversationsApi = {
  list: () => api<Conversation[]>('/conversations'),
  create: (body: CreateConversationBody) =>
    api<{ id: string; currentKeyVersion: number }>('/conversations', { method: 'POST', body }),
  messages: (id: string, cursor?: string | null, signal?: AbortSignal) =>
    api<Page<EncryptedMessage>>(`/conversations/${id}/messages`, {
      query: { cursor: cursor ?? undefined },
      signal,
    }),
  markRead: (id: string) => api(`/conversations/${id}/read`, { method: 'POST' }),
};

export interface CreatedUser {
  id: string;
  username: string;
  loginCode: string;
}

export const adminApi = {
  users: () => api<AdminUser[]>('/admin/users'),
  createUser: (body: { username: string; displayName: string }) =>
    api<CreatedUser>('/admin/users', { method: 'POST', body }),
  resetCode: (id: string) => api<{ loginCode: string }>(`/admin/users/${id}/reset-code`, { method: 'POST' }),
  setStatus: (id: string, status: 'active' | 'disabled') =>
    api(`/admin/users/${id}`, { method: 'PATCH', body: { status } }),
  deleteUser: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
  audit: (cursor?: string | null) =>
    api<Page<AuditEntry>>('/admin/audit', { query: { cursor: cursor ?? undefined } }),
};
