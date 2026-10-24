import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How VaultChat handles account information, encrypted messages, and service data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Privacy Policy" updated="24 October 2026">
      <p>This policy explains how SiliconBrains (“we”, “us”) handles personal data when you use VaultChat. VaultChat is a private messaging service operated by SiliconBrains in Nagpur, India. We act as the data fiduciary or controller for personal data processed to operate the service.</p>
      <LegalSection title="1. Information we handle">
        <p><strong>Account information.</strong> We process information associated with your account, such as your name, email address, account status and sign-in identifiers. Authentication is provided by Clerk.</p>
        <p><strong>Messages and keys.</strong> Message text and voice notes are encrypted on your device before transmission. Our service stores ciphertext, nonces, message and conversation identifiers, timestamps, expiry times, and encrypted key material needed to deliver messages. We do not have the keys needed to read message content. Other conversation members may read content they can decrypt.</p>
        <p><strong>Service and security data.</strong> We process technical data needed to run and protect the service, which may include IP addresses in security audit records, device and public-key metadata, access events, and diagnostic information. Administrators can see account and security metadata, but not message content.</p>
      </LegalSection>
      <LegalSection title="2. How we use information">
        <p>We use information to authenticate accounts, provide messaging and account features, manage administrator approval, protect the service, investigate abuse or security events, maintain the service, and meet legal obligations. We do not sell personal data or use message contents for advertising.</p>
      </LegalSection>
      <LegalSection title="3. Encryption and message expiry">
        <p>Message content is encrypted in your browser before it is sent. This limits our ability to access message contents, but does not protect content from people you send it to, compromised devices, screenshots, or information you choose to disclose.</p>
        <p>Messages are scheduled to expire 10 hours after sending and are removed from message history and purged by the service. Expiry does not remove copies, notifications, or recordings a recipient may have made outside VaultChat. Account, audit, and technical records may be retained separately where needed for service operation, security, or legal compliance.</p>
      </LegalSection>
      <LegalSection title="4. Providers and disclosures">
        <p>We use service providers needed to operate VaultChat, including Clerk for authentication, hosting and database providers, and infrastructure or security services. Providers may process information in other countries under their own terms and our service arrangements. We may also disclose information when required by law, to protect users or the service, or as part of a business transfer subject to applicable law. We do not sell personal data.</p>
      </LegalSection>
      <LegalSection title="5. Retention and security">
        <p>We keep information for as long as needed to provide the service, meet security and legal requirements, and resolve disputes. Messages are designed to expire after 10 hours as described above. We use measures such as encryption in transit, access controls and least-privilege permissions. No system can be guaranteed completely secure.</p>
      </LegalSection>
      <LegalSection title="6. Your choices and rights">
        <p>Depending on where you live, you may be able to request access to, correction or deletion of your personal data, withdraw consent, object to certain processing, or complain to a data protection authority. Some information may need to be retained where the law permits or requires it. To make a request, email <a className="font-semibold text-primary-600" href="mailto:privacy@siliconbrains.in">privacy@siliconbrains.in</a>. We may need to verify your identity before responding.</p>
      </LegalSection>
      <LegalSection title="7. Children">
        <p>VaultChat is intended for adults and is not directed to children under 18. If you believe a child has provided us personal data, contact us so we can review and address the request.</p>
      </LegalSection>
      <LegalSection title="8. Changes and contact">
        <p>We may update this policy as VaultChat changes or legal requirements evolve. We will update the date above and provide notice of material changes where appropriate. Questions, requests, or grievances can be sent to <a className="font-semibold text-primary-600" href="mailto:privacy@siliconbrains.in">privacy@siliconbrains.in</a>. SiliconBrains is based in Nagpur, India.</p>
      </LegalSection>
    </LegalPage>
  );
}
