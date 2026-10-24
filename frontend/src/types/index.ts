export type Role = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'disabled';
export type ConversationType = 'direct' | 'group' | 'broadcast';
export type MemberRole = 'owner' | 'member' | 'sender';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  keyFingerprint: string | null;
  managementVerified: boolean;
}

export interface DirectoryUser {
  id: string;
  username: string;
  displayName: string;
  /** base64 SPKI (ECDH P-256); null until first login */
  publicKey: string | null;
  keyFingerprint: string | null;
  managementVerified: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  role: Role;
  status: UserStatus;
  managementVerified: boolean;
  keyFingerprint: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminStats {
  usersTotal: number;
  usersPending: number;
  usersActive: number;
  usersDisabled: number;
  liveMessages: number;
  conversationsTotal: number;
  lastPurgeAt: string | null;
  lastPurgeDeleted: number | null;
}

export interface AuditEntry {
  id: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface WrappedKey {
  keyVersion: number;
  wrappedKey: string;
  wrapperPub: string;
}

export interface ConversationMember {
  userId: string;
  displayName: string;
  role: MemberRole;
  managementVerified: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  groupIcon: string | null;
  currentKeyVersion: number;
  members: ConversationMember[];
  /** This user's wrapped keys, all live versions. */
  keys: WrappedKey[];
  myRole: MemberRole;
  unreadCount: number;
  lastMessageAt: string | null;
  /** Earliest expires_at among live messages, if any. */
  nextExpiryAt: string | null;
}

export interface EncryptedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  ciphertext: string | null;
  nonce: string | null;
  keyVersion: number;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type MessageStatus = 'ok' | 'pending' | 'failed' | 'undecryptable' | 'deleted';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  keyVersion: number;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  text: string | null;
  status: MessageStatus;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

