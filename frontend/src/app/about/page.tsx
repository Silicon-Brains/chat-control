import type { Metadata } from 'next';
import { LockKeyhole, Clock3, ShieldCheck } from 'lucide-react';
import { LegalPage, LegalSection } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'About VaultChat',
  description: 'Learn about VaultChat, a private messaging app built around encryption and short-lived conversations.',
};

export default function AboutPage() {
  return (
    <LegalPage eyebrow="About us" title="Private conversations, by design." updated="24 October 2026">
      <p>VaultChat is a private messaging application built by SiliconBrains, an independent web engineering practice based in Nagpur, India. We want private conversations to be simple to use and intentional about privacy.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: LockKeyhole, title: 'Encrypted on your device', text: 'Message content is encrypted before it is sent. The service stores encrypted message content and cannot read it.' },
          { icon: Clock3, title: 'Short-lived history', text: 'Messages are designed to expire and be deleted 10 hours after they are sent.' },
          { icon: ShieldCheck, title: 'Controlled access', text: 'New accounts require administrator approval before members can use the app.' },
        ].map(({ icon: Icon, title, text }) => (
          <section key={title} className="rounded-card border border-white/60 bg-white/30 p-4">
            <Icon className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="mt-3 font-bold text-ink-900">{title}</h2>
            <p className="mt-1 text-sm leading-6">{text}</p>
          </section>
        ))}
      </div>
      <LegalSection title="Who operates VaultChat?">
        <p>VaultChat is operated by SiliconBrains (Silicon Brains), an independent web engineering practice led by a Senior Web Engineer in Nagpur, India. For privacy questions, contact <a className="font-semibold text-primary-600" href="mailto:privacy@siliconbrains.in">privacy@siliconbrains.in</a>.</p>
      </LegalSection>
      <LegalSection title="Get in touch">
        <p>For questions about VaultChat, privacy requests, or support, email <a className="font-semibold text-primary-600" href="mailto:privacy@siliconbrains.in">privacy@siliconbrains.in</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
