import Link from 'next/link';

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto min-h-dvh max-w-content px-4 py-5 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink-900">VaultChat</Link>
        <Link href="/" className="rounded-tile px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-white/50">Home</Link>
      </header>
      <article className="glass mx-auto my-8 max-w-3xl rounded-modal p-5 sm:my-12 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-600">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-400">Last updated: {updated}</p>
        <div className="prose-legal mt-8 space-y-7 text-sm leading-7 text-ink-600 sm:text-base">
          {children}
        </div>
      </article>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 border-t border-white/50 py-5 text-sm text-ink-600">
        <Link href="/about" className="hover:text-primary-600">About</Link>
        <Link href="/privacy" className="hover:text-primary-600">Privacy policy</Link>
        <Link href="/terms" className="hover:text-primary-600">Terms of use</Link>
      </footer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
