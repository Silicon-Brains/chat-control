import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock3,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Private conversations, by design',
  description:
    'VaultChat keeps conversations end-to-end encrypted, gives you control over who joins, and automatically expires messages.',
  robots: { index: true, follow: true },
};

const features = [
  {
    icon: LockKeyhole,
    title: 'Private by design',
    description: 'Messages are encrypted on your device. The server stores ciphertext, not readable conversations.',
    accent: 'bg-primary-500/10 text-primary-600',
  },
  {
    icon: Clock3,
    title: 'Less history to worry about',
    description: 'Messages automatically expire after 10 hours, keeping old conversations from lingering.',
    accent: 'bg-accent-orange/15 text-[#9A5D1E]',
  },
  {
    icon: ShieldCheck,
    title: 'People-first access',
    description: 'Anyone can request an account. An administrator approves access before a new member can chat.',
    accent: 'bg-accent-purple/10 text-[#6D5CC1]',
  },
];

export default function LandingPage() {
  return (
    <main id="main" className="overflow-hidden">
      <header className="mx-auto flex max-w-content items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:py-5 lg:px-12">
        <Link href="/" aria-label="VaultChat home" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-primary-gradient text-white shadow-glass sm:h-10 sm:w-10">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight text-ink-900 sm:text-lg">VaultChat</span>
        </Link>
        <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className="whitespace-nowrap rounded-tile px-2.5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white/40 sm:px-4"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-tile bg-primary-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-glass transition hover:shadow-lift sm:px-4"
          >
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Request access</span>
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-content items-center gap-10 px-4 pb-16 pt-8 sm:gap-14 sm:px-8 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="min-w-0 motion-safe:animate-fade-up">
          <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/50 px-3 py-2 text-xs font-medium text-primary-600 shadow-glass sm:mb-6 sm:px-3.5 sm:text-sm">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>A quieter kind of secure messaging</span>
          </div>
          <h1 className="max-w-2xl text-[clamp(2.35rem,10vw,4.5rem)] font-bold leading-[1.08] tracking-[-0.045em] text-ink-900">
            Your conversations.
            <span className="block text-primary-600">Your privacy.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-600 sm:mt-6 sm:text-lg sm:leading-8">
            A private space for meaningful conversations—with end-to-end encryption, thoughtful access controls,
            and messages that don’t stay forever.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-tile bg-primary-gradient px-5 py-3 text-center font-semibold text-white shadow-glass transition hover:shadow-lift sm:px-6"
            >
              Create your account
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-tile border border-white/80 bg-white/40 px-4 py-3 text-center text-sm font-semibold text-ink-900 transition hover:bg-white/70 sm:px-6 sm:text-base"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-600">
            New accounts are reviewed by an administrator before access is enabled.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-lg motion-safe:md:animate-float lg:justify-self-end">
          <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-white/50 via-lavender/30 to-primary-500/15 blur-lg sm:-inset-8 sm:blur-2xl" aria-hidden />
          <div className="glass relative rounded-modal p-3 sm:p-6">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-ink-900/5 px-1 pb-4 sm:px-2">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-500/10 text-primary-600 sm:h-11 sm:w-11">
                  <LockKeyhole className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900 sm:text-base">A private conversation</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-primary-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    End-to-end encrypted
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-white/60 px-2 py-1.5 text-[11px] font-medium text-ink-600 sm:px-3 sm:text-xs">Just now</span>
            </div>
            <div className="space-y-4 px-1 py-6">
              <div className="max-w-[82%] rounded-bubble rounded-tl-md bg-white/70 p-4 shadow-sm">
                <p className="text-sm leading-6 text-ink-900">Good ideas deserve a little more privacy.</p>
                <p className="mt-2 text-[11px] text-ink-400">10:42 AM</p>
              </div>
              <div className="ml-auto max-w-[82%] rounded-bubble rounded-tr-md bg-primary-gradient p-4 text-white shadow-glass">
                <p className="text-sm leading-6">And a little less digital baggage.</p>
                <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-white/75">
                  <Check className="h-3 w-3" aria-hidden />
                  10:43 AM
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-tile border border-white/70 bg-white/40 px-2.5 py-2.5 text-[11px] leading-4 text-ink-600 sm:px-3 sm:text-xs">
                <Clock3 className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                Messages in this chat expire after 10 hours
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-tile border border-white/80 bg-white/60 p-2 sm:gap-3 sm:p-2.5">
              <span className="min-w-0 flex-1 truncate px-2 text-xs text-ink-400 sm:text-sm">Write a message…</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-icon bg-primary-gradient text-white" aria-hidden>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/50 bg-white/20">
        <div className="mx-auto grid max-w-content gap-4 px-4 py-6 sm:grid-cols-3 sm:px-8 sm:py-7 lg:px-12">
          {[
            ['01', 'Encrypted on your device'],
            ['02', 'Reviewed access'],
            ['03', 'Automatic message expiry'],
          ].map(([number, label]) => (
            <div key={number} className="flex items-center gap-3 px-2">
              <span className="text-xs font-bold tracking-widest text-primary-600">{number}</span>
              <span className="text-sm font-semibold text-ink-900">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-600">Built around trust</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Simple to use. Intentional about privacy.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description, accent }) => (
            <article key={title} className="glass rounded-card p-6 sm:p-7">
              <span className={`grid h-12 w-12 place-items-center rounded-tile ${accent}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 pb-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-28">
        <div className="overflow-hidden rounded-modal bg-ink-900 px-5 py-10 text-center shadow-lift sm:px-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-300">Your space is waiting</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Make room for better conversations.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
            Create an account in a few moments. Once approved, your private conversations are ready.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-tile bg-white px-6 font-semibold text-ink-900 transition hover:bg-mint"
          >
            Request access
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-content flex-col gap-2 border-t border-white/50 px-4 py-6 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p>© {new Date().getFullYear()} VaultChat</p>
        <nav aria-label="Company and legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/about" className="hover:text-primary-600">About</Link>
          <Link href="/privacy" className="hover:text-primary-600">Privacy policy</Link>
          <Link href="/terms" className="hover:text-primary-600">Terms of use</Link>
        </nav>
      </footer>
    </main>
  );
}
