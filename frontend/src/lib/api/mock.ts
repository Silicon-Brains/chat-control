/* Dev-only in-memory fake of the VaultChat API. Enabled with NEXT_PUBLIC_MOCK=true. */
import { fingerprintOf } from '@/lib/crypto/keys';
import { toB64 } from '@/lib/crypto/encoding';
import { MESSAGE_TTL_MS } from '@/lib/constants';
import type {
  AdminUser, AuditEntry, ClientSendEvent, Conversation, DirectoryUser, EncryptedMessage, User, WrappedKey,
} from '@/types';
import { ApiError, type RefreshResponse } from './client';

export const MOCK_CREDENTIALS = {
  users: { alice: 'a1b2c3d4e5', bob: 'b1b2c3d4e5', carol: 'c1b2c3d4e5' } as Record<string, string>,
  admin: { username: 'admin', adminCode: 'local-admin-code-0123456789', totp: '123456' },
};

interface MockUser extends AdminUser { publicKey: string | null }
interface MockConv {
  id: string; type: Conversation['type']; name: string | null; groupIcon: string | null; currentKeyVersion: number;
  members: Conversation['members']; keys: Record<string, WrappedKey[]>; messages: EncryptedMessage[];
}

const SESSION = 'vc_mock_session';
const users: MockUser[] = [];
const convs: MockConv[] = [];
const audit: AuditEntry[] = [];
let ready: Promise<void> | null = null;
let auditSeq = 0;

const log = (actor: MockUser | undefined, action: string, targetId: string | null = null) =>
  audit.unshift({ id: ++auditSeq, actorId: actor?.id ?? null, actorName: actor?.displayName ?? null, action, targetId, ip: '127.0.0.1', createdAt: new Date().toISOString() });

async function seed() {
  const base = [['alice', 'Alice Rao'], ['bob', 'Bob Mehta'], ['carol', 'Carol Singh']];
  for (const [username, displayName] of base) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    users.push({
      id: `u-${username}`, username: username!, displayName: displayName!, role: 'user', status: 'active',
      managementVerified: false,
      publicKey: toB64(spki), keyFingerprint: await fingerprintOf(spki),
      createdAt: new Date().toISOString(), lastLoginAt: null,
    });
  }
  users.push({
    id: 'u-admin', username: 'admin', displayName: 'Admin', role: 'admin', status: 'active',
    managementVerified: false,
    publicKey: null, keyFingerprint: null, createdAt: new Date().toISOString(), lastLoginAt: null,
  });
  users.push({
    id: 'u-pending', username: 'new_member', displayName: 'New Member', role: 'user', status: 'pending',
    managementVerified: false,
    publicKey: null, keyFingerprint: null, createdAt: new Date().toISOString(), lastLoginAt: null,
  });
}

const toUser = (u: MockUser): User => ({
  id: u.id, username: u.username, displayName: u.displayName, role: u.role,
  keyFingerprint: u.keyFingerprint, managementVerified: u.managementVerified,
});
const current = () => {
  const id = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION) : null;
  return users.find((u) => u.id === id);
};
const requireUser = () => {
  const u = current();
  if (!u) throw new ApiError(401, 'UNAUTHENTICATED', 'Not signed in');
  return u;
};
const requireAdmin = () => {
  const u = requireUser();
  if (u.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Admins only');
  return u;
};
const code = () => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('');
const fail = (status: number, c: string, m: string) => { throw new ApiError(status, c, m); };
const toConversation = (c: MockConv, userId: string): Conversation => {
  const last = c.messages.at(-1);
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    groupIcon: c.groupIcon,
    currentKeyVersion: c.currentKeyVersion,
    members: c.members,
    keys: c.keys[userId] ?? [],
    myRole: c.members.find((member) => member.userId === userId)!.role,
    unreadCount: 0,
    lastMessageAt: last?.createdAt ?? null,
    nextExpiryAt: c.messages[0]?.expiresAt ?? null,
  };
};

export async function mockRefresh(): Promise<RefreshResponse | null> {
  await (ready ??= seed());
  const u = current();
  return u && u.status === 'active' ? { accessToken: 'mock-token', user: toUser(u) } : null;
}

export async function mockRequest<T>(path: string, opts: { method?: string; body?: unknown }): Promise<T> {
  await (ready ??= seed());
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  const method = opts.method ?? 'GET';
  const body = (opts.body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const out = (v?: unknown) => v as T;
  let m: RegExpMatchArray | null;

  if (path === '/auth/login') {
    const u = users.find((x) => x.username === body.username && x.role === 'user');
    if (!u || u.status !== 'active' || MOCK_CREDENTIALS.users[u.username] !== body.code) {
      log(undefined, 'login.fail'); fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    sessionStorage.setItem(SESSION, u!.id); u!.lastLoginAt = new Date().toISOString();
    return out({ accessToken: 'mock-token', user: toUser(u!) });
  }
  if (path === '/admin/auth/login') {
    const a = MOCK_CREDENTIALS.admin;
    if (body.username !== a.username || body.adminCode !== a.adminCode || body.totp !== a.totp) {
      log(undefined, 'login.fail'); fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    const u = users.find((x) => x.role === 'admin')!;
    sessionStorage.setItem(SESSION, u.id); u.lastLoginAt = new Date().toISOString();
    return out({ accessToken: 'mock-token', user: toUser(u) });
  }
  if (path === '/auth/logout') { sessionStorage.removeItem(SESSION); return out(); }
  if (path === '/auth/ws-ticket') { requireUser(); return out({ ticket: 'mock' }); }

  if (path === '/users') {
    requireUser();
    const dir: DirectoryUser[] = users.filter((u) => u.role === 'user' && u.status === 'active')
      .map((u) => ({
        id: u.id, username: u.username, displayName: u.displayName, publicKey: u.publicKey,
        keyFingerprint: u.keyFingerprint, managementVerified: u.managementVerified,
      }));
    return out(dir);
  }
  if (path === '/users/me/key' && method === 'PUT') {
    const me = requireUser();
    const spki = Uint8Array.from(atob(body.publicKey), (c) => c.charCodeAt(0));
    me.publicKey = body.publicKey; me.keyFingerprint = await fingerprintOf(spki);
    return out();
  }
  if (path === '/users/me/key/reset' && method === 'POST') {
    const me = requireUser();
    if (me.role !== 'user') fail(403, 'FORBIDDEN', 'Only user accounts can reset device keys');
    const spki = Uint8Array.from(atob(body.publicKey), (c) => c.charCodeAt(0));
    me.publicKey = body.publicKey; me.keyFingerprint = await fingerprintOf(spki);
    for (let i = convs.length - 1; i >= 0; i--) {
      const conv = convs[i]!;
      if (!conv.members.some((member) => member.userId === me.id)) continue;
      if (conv.type === 'direct') convs.splice(i, 1);
      else delete conv.keys[me.id];
    }
    log(me, 'user.reset_key', me.id);
    return out();
  }

  if (path === '/conversations' && method === 'GET') {
    const me = requireUser();
    const list = convs.filter((c) => c.members.some((x) => x.userId === me.id)).map((c) => toConversation(c, me.id));
    return out(list);
  }
  if (path === '/conversations' && method === 'POST') {
    const me = requireUser();
    const ids = (body.members as { userId: string }[]).map((x) => x.userId);
    if (body.type === 'direct') {
      const existing = convs.find((c) => c.type === 'direct' && c.members.length === 2 && ids.every((i) => c.members.some((x) => x.userId === i)));
      if (existing) return out({ id: existing.id, currentKeyVersion: existing.currentKeyVersion });
    }
    const conv: MockConv = {
      id: crypto.randomUUID(), type: body.type, name: body.name ?? null, groupIcon: null, currentKeyVersion: 1, messages: [],
      members: ids.map((id) => ({
        userId: id,
        displayName: users.find((u) => u.id === id)?.displayName ?? id,
        role: id === me.id ? 'owner' : 'member',
        managementVerified: users.find((u) => u.id === id)?.managementVerified ?? false,
      })),
      keys: Object.fromEntries((body.members as { userId: string; wrappedKey: string; wrapperPub: string }[])
        .map((x) => [x.userId, [{ keyVersion: 1, wrappedKey: x.wrappedKey, wrapperPub: x.wrapperPub }]])),
    };
    convs.push(conv);
    return out({ id: conv.id, currentKeyVersion: 1 });
  }
  if ((m = path.match(/^\/conversations\/([^/]+)$/))) {
    const me = requireUser();
    const index = convs.findIndex((conversation) => conversation.id === m![1]);
    const conv = convs[index];
    if (!conv || !conv.members.some((member) => member.userId === me.id)) fail(404, 'NOT_FOUND', 'Not found');
    if (method === 'GET') return out(toConversation(conv!, me.id));
    if (method === 'PATCH' || method === 'DELETE') {
      if (conv!.type !== 'group') fail(409, 'NOT_A_GROUP', 'Only groups can be edited or deleted');
      if (conv!.members.find((member) => member.userId === me.id)?.role !== 'owner') {
        fail(403, 'NOT_OWNER', 'Only the owner can do this');
      }
      if (method === 'DELETE') {
        convs.splice(index, 1);
        log(me, 'conversation.group_delete', conv!.id);
        return out();
      }
      if (typeof body.name === 'string') conv!.name = body.name.trim();
      if (body.groupIcon === null || typeof body.groupIcon === 'string') conv!.groupIcon = body.groupIcon;
      log(me, 'conversation.group_update', conv!.id);
      return out(toConversation(conv!, me.id));
    }
  }
  if ((m = path.match(/^\/conversations\/([^/]+)\/messages$/))) {
    const me = requireUser();
    const c = convs.find((x) => x.id === m![1]);
    if (!c?.members.some((x) => x.userId === me.id)) fail(404, 'NOT_FOUND', 'Not found');
    const now = Date.now();
    c!.messages = c!.messages.filter((x) => new Date(x.expiresAt).getTime() > now);
    return out({ items: [...c!.messages].reverse(), nextCursor: null });
  }
  if (/^\/conversations\/[^/]+\/read$/.test(path)) return out();

  // ---- admin ----
  if (path === '/admin/users' && method === 'GET') {
    requireAdmin();
    return out(users.map((u) => {
      const { publicKey, ...safe } = u;
      void publicKey;
      return safe;
    }));
  }
  if (path === '/admin/stats' && method === 'GET') {
    requireAdmin();
    return out({
      usersTotal: users.filter((u) => u.role === 'user').length,
      usersPending: users.filter((u) => u.role === 'user' && u.status === 'pending').length,
      usersActive: users.filter((u) => u.role === 'user' && u.status === 'active').length,
      usersDisabled: users.filter((u) => u.role === 'user' && u.status === 'disabled').length,
      liveMessages: convs.reduce((sum, c) => sum + c.messages.length, 0),
      wsConnections: 0,
      conversationsTotal: convs.length,
      lastPurgeAt: null,
      lastPurgeDeleted: null,
    });
  }
  if (path === '/admin/users' && method === 'POST') {
    const admin = requireAdmin();
    if (users.some((u) => u.username === body.username)) fail(409, 'CONFLICT', 'Username taken');
    const u: MockUser = {
      id: `u-${body.username}`, username: body.username, displayName: body.displayName, role: 'user', status: 'active',
      managementVerified: false,
      publicKey: null, keyFingerprint: null, createdAt: new Date().toISOString(), lastLoginAt: null,
    };
    users.push(u); const c = code(); MOCK_CREDENTIALS.users[u.username] = c; log(admin, 'user.create', u.id);
    return out({ id: u.id, username: u.username, loginCode: c });
  }
  if ((m = path.match(/^\/admin\/users\/([^/]+)\/approve$/)) && method === 'POST') {
    const admin = requireAdmin(); const u = users.find((x) => x.id === m![1]);
    if (!u) fail(404, 'NOT_FOUND', 'Not found');
    if (u!.status !== 'pending') fail(409, 'USER_NOT_PENDING', 'User is not pending approval');
    u!.status = 'active'; log(admin, 'user.approve', u!.id);
    return out(u);
  }
  if ((m = path.match(/^\/admin\/users\/([^/]+)\/reset-key$/)) && method === 'POST') {
    const admin = requireAdmin(); const u = users.find((x) => x.id === m![1]);
    if (!u) fail(404, 'NOT_FOUND', 'Not found');
    u!.publicKey = null; u!.keyFingerprint = null; log(admin, 'user.reset_key', u!.id);
    return out();
  }
  if ((m = path.match(/^\/admin\/users\/([^/]+)\/reset-code$/))) {
    const admin = requireAdmin(); const u = users.find((x) => x.id === m![1]);
    if (!u) fail(404, 'NOT_FOUND', 'Not found');
    const c = code(); MOCK_CREDENTIALS.users[u!.username] = c; u!.publicKey = null; u!.keyFingerprint = null;
    log(admin, 'user.reset_code', u!.id); return out({ loginCode: c });
  }
  if ((m = path.match(/^\/admin\/users\/([^/]+)$/))) {
    const admin = requireAdmin(); const i = users.findIndex((x) => x.id === m![1]);
    if (i < 0) fail(404, 'NOT_FOUND', 'Not found');
    if (method === 'PATCH') {
      const target = users[i]!;
      if (body.status) {
        target.status = body.status;
        log(admin, `user.${body.status === 'active' ? 'enable' : 'disable'}`, target.id);
      }
      if (body.role && body.role !== target.role) {
        if (target.id === admin.id) fail(409, 'SELF_ROLE_CHANGE', 'You cannot change your own role');
        if (body.role === 'admin' && target.status !== 'active') fail(409, 'USER_NOT_ACTIVE', 'Only active users can be promoted to admin');
        if (body.role === 'user' && target.role === 'admin' && target.status === 'active'
          && users.filter((u) => u.role === 'admin' && u.status === 'active').length <= 1) {
          fail(409, 'LAST_ADMIN', 'At least one active admin must remain');
        }
        target.role = body.role;
        log(admin, 'user.role_update', target.id);
      }
      if (typeof body.managementVerified === 'boolean') {
        target.managementVerified = body.managementVerified;
        log(admin, 'user.management_verification', target.id);
      }
      return out(target);
    }
    if (method === 'DELETE') { log(admin, 'user.delete', users[i]!.id); users.splice(i, 1); }
    return out();
  }
  if (path === '/admin/audit') { requireAdmin(); return out({ items: audit, nextCursor: null }); }

  return fail(404, 'NOT_FOUND', `Mock: no handler for ${method} ${path}`);
}

/** Loopback for WebSocket sends: stores the ciphertext and returns the broadcast event. */
export function mockSend(e: Extract<ClientSendEvent, { t: 'message.send' }>): EncryptedMessage | null {
  const me = current();
  const c = convs.find((x) => x.id === e.conversationId);
  if (!me || !c?.members.some((x) => x.userId === me.id)) return null;
  const now = Date.now();
  const msg: EncryptedMessage = {
    id: e.id, conversationId: c.id, senderId: me.id, ciphertext: e.ciphertext, nonce: e.nonce, keyVersion: e.keyVersion,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + MESSAGE_TTL_MS).toISOString(),
  };
  c.messages.push(msg);
  return msg;
}
