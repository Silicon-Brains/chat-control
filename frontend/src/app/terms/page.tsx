import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms for using the VaultChat messaging service.',
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Terms of Use" updated="24 October 2026">
      <p>These terms apply to your use of VaultChat, a messaging service operated by SiliconBrains (“we”, “us”) in Nagpur, India. By creating an account or using VaultChat, you agree to these terms. If you do not agree, do not use the service.</p>
      <LegalSection title="1. Eligibility and accounts">
        <p>You must be at least 18 years old and able to enter into a binding agreement to use VaultChat. Provide accurate account information, keep your sign-in credentials and devices secure, and promptly tell us if you believe your account has been accessed without permission. New accounts may require administrator approval before they can use the service.</p>
      </LegalSection>
      <LegalSection title="2. Acceptable use">
        <p>Use VaultChat lawfully and respectfully. You may not use it to threaten, harass, defraud, exploit, or harm others; distribute unlawful content; violate another person’s rights; attempt to gain unauthorized access; interfere with the service or its security; or use the service in a way that violates applicable law.</p>
        <p>You are responsible for the content you send and for ensuring you have the rights and permissions needed to share it with conversation members.</p>
      </LegalSection>
      <LegalSection title="3. Privacy and message delivery">
        <p>Our <a className="font-semibold text-primary-600" href="/privacy">Privacy Policy</a> describes how service data is handled. Message content is encrypted on your device; the service stores ciphertext and cannot ordinarily read message contents. Encryption does not prevent recipients from sharing or capturing content, nor does it protect an account or device that has been compromised.</p>
        <p>Messages are designed to expire 10 hours after sending. Expiry may not delete copies made outside the service. Keep any content you need before it expires.</p>
      </LegalSection>
      <LegalSection title="4. Your access and our service">
        <p>We may suspend or terminate access when necessary to protect users, investigate suspected misuse, comply with law, or maintain service security. We may change or discontinue features, and will provide notice where reasonably practical. We do not guarantee uninterrupted or error-free availability.</p>
      </LegalSection>
      <LegalSection title="5. Intellectual property and feedback">
        <p>VaultChat and its software, design, and branding are owned by SiliconBrains or its licensors and are protected by applicable laws. We grant you a limited, personal, non-exclusive, revocable right to use the service in accordance with these terms. You retain rights to content you submit and grant us only the limited rights needed to operate and secure VaultChat. If you send suggestions, we may use them to improve the service without obligation to you.</p>
      </LegalSection>
      <LegalSection title="6. Disclaimers and liability">
        <p>To the extent permitted by law, VaultChat is provided “as is” and “as available”, without warranties that the service will always be available, secure, or suitable for every purpose. Nothing in these terms excludes rights or liability that cannot be excluded under applicable law.</p>
        <p>To the extent permitted by law, SiliconBrains will not be liable for indirect or consequential loss, loss of data, or loss of business arising from use of the service. Nothing here limits liability for fraud, wilful misconduct, or other liability that cannot legally be limited.</p>
      </LegalSection>
      <LegalSection title="7. Changes and contact">
        <p>We may revise these terms by updating the date above. For material changes, we will provide reasonable notice where appropriate. Continued use after changes take effect means you accept the revised terms. Questions can be sent to <a className="font-semibold text-primary-600" href="mailto:privacy@siliconbrains.in">privacy@siliconbrains.in</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
