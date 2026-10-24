import Link from 'next/link';

/** Lightweight CSS "3D" hero — no WebGL, no image payload. Motion is disabled by prefers-reduced-motion. */
export function HeroBanner({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-primary-gradient p-8 text-white shadow-glass">
      <div className="relative z-10 max-w-sm">
        <h2 className="text-2xl font-bold !text-white">{title}</h2>
        <p className="mt-2 text-white/85">{body}</p>
        <Link href={href} className="hero-banner-cta mt-6 inline-flex h-11 items-center rounded-full bg-[#F4FAF9] px-6 font-semibold text-[#245E61] transition hover:shadow-lift">
          {cta}
        </Link>
      </div>
      <div aria-hidden className="pointer-events-none absolute -right-6 top-1/2 hidden h-48 w-64 -translate-y-1/2 sm:block">
        <span className="absolute right-24 top-2 h-20 w-20 animate-float rounded-full bg-[radial-gradient(circle_at_30%_30%,#E4F59A,#B6D84A_60%,#7FA21C)] shadow-[0_16px_30px_rgba(0,0,0,0.25)]" />
        <span className="absolute right-4 top-16 h-28 w-28 rotate-12 animate-float rounded-[28px] border border-white/60 bg-white/25 shadow-[0_20px_40px_rgba(0,0,0,0.2)] backdrop-blur [animation-delay:-2s]" />
        <span className="absolute bottom-0 right-36 h-14 w-14 -rotate-12 animate-float rounded-2xl bg-gradient-to-br from-[#C7C2EA] to-[#8E7CE6] shadow-[0_12px_24px_rgba(0,0,0,0.2)] [animation-delay:-4s]" />
      </div>
    </section>
  );
}
