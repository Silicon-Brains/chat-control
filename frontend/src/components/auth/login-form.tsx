'use client';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { adminLoginSchema, fieldErrors, userLoginSchema } from '@/lib/validation';
import { useSession } from '@/stores/session';

type Errors = Record<string, string | undefined>;

export function LoginForm({ mode }: { mode: 'user' | 'admin' }) {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const admin = mode === 'admin';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = admin ? adminLoginSchema.safeParse(f) : userLoginSchema.safeParse(f);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error) as Errors);
    setErrors({});
    setLoading(true);
    try {
      const res = admin
        ? await authApi.adminLogin(parsed.data as { username: string; adminCode: string; totp: string })
        : await authApi.login(parsed.data as { username: string; code: string });
      await signIn(res);
      router.replace(admin ? '/admin' : '/');
    } catch (err) {
      // Deliberately generic for credential failures — never reveal which field was wrong.
      setFormError(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Wait a few minutes and try again.'
          : err instanceof ApiError && err.code === 'NETWORK'
            ? err.message
            : 'Sign-in failed. Check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <GlassCard className="w-full max-w-md animate-fade-up p-8">
        <Logo />
        <h1 className="mt-6 text-3xl font-bold">{admin ? 'Admin sign in' : 'Welcome back'}</h1>
        <p className="mt-1 text-sm">
          {admin ? 'Use your admin code and authenticator app.' : 'Sign in with the username and code your admin gave you.'}
        </p>
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <Input name="username" label="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} error={errors.username} />
          {admin ? (
            <>
              <Input name="adminCode" label="Admin code" type="password" autoComplete="current-password" error={errors.adminCode} />
              <Input name="totp" label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={errors.totp} />
            </>
          ) : (
            <Input name="code" label="Login code" type="password" autoComplete="current-password" maxLength={10} spellCheck={false} error={errors.code} />
          )}
          {formError && <p role="alert" className="rounded-field bg-danger/10 px-4 py-3 text-sm text-[#B8434D]">{formError}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>
        <p className="mt-6 flex items-center gap-2 text-xs"><ShieldCheck className="h-4 w-4 text-primary-500" aria-hidden />End-to-end encrypted. Messages disappear after 10 hours.</p>
      </GlassCard>
    </main>
  );
}
