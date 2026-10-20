import { ClerkProvider } from '@clerk/nextjs';
import { env } from '@/lib/env';

/**
 * Server component: Clerk reads the CSP nonce from the request (`dynamic`).
 */
export function ClerkShell({ children }: { children: React.ReactNode }) {
  if (env.mock) return <>{children}</>;
  return (
    <ClerkProvider
      dynamic
      afterSignOutUrl="/login"
      signInUrl="/login"
      signUpUrl="/signup"
      appearance={{
        variables: {
          colorPrimary: '#3E8C8F',
          colorText: '#1E2B2A',
          colorTextSecondary: '#5A6B6A',
          borderRadius: '14px',
          fontFamily: 'var(--font-jakarta), Inter, system-ui, sans-serif',
        },
        elements: {
          card: 'glass !border-white/70 !bg-white/[0.45] !shadow-glass',
          formButtonPrimary: '!bg-primary-gradient hover:!shadow-lift',
          footerAction__signIn: 'text-ink-600',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
