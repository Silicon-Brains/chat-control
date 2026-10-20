import { AlertCircle, Clock, LockKeyhole } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { VerifiedMark } from '@/components/ui/verified-mark';
import type { ChatMessage } from '@/types';
import { ExpiryChip } from './expiry-chip';

export function MessageBubble({
  message,
  mine,
  senderName,
  senderVerified = false,
}: {
  message: ChatMessage;
  mine: boolean;
  senderName?: string;
  senderVerified?: boolean;
}) {
  const broken = message.status === 'undecryptable';
  return (
    <li className={cn('flex animate-fade-up', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[min(34rem,85%)]', mine && 'text-right')}>
        {!mine && senderName && (
          <p className="mb-1 flex items-center gap-1 px-2 text-xs font-medium text-ink-600">
            {senderName}{senderVerified && <VerifiedMark />}
          </p>
        )}
        <div
          className={cn(
            'rounded-bubble px-4 py-2.5 text-left text-[15px] leading-6',
            mine ? 'rounded-br-md bg-primary-gradient text-white' : 'glass !rounded-bubble rounded-bl-md text-ink-900',
            message.status === 'failed' && 'ring-2 ring-danger',
          )}
        >
          {broken ? (
            <span className="inline-flex items-center gap-2 italic opacity-80">
              <LockKeyhole className="h-4 w-4" aria-hidden />Can’t decrypt on this device
            </span>
          ) : (
            // React escapes text — never use dangerouslySetInnerHTML for messages.
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>
        <div className={cn('mt-1 flex items-center gap-2 px-2 text-[11px] text-ink-400', mine && 'justify-end')}>
          {message.status === 'pending' && <Clock className="h-3 w-3" aria-label="Sending" />}
          {message.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-danger"><AlertCircle className="h-3 w-3" aria-hidden />Not sent</span>
          )}
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          <ExpiryChip expiresAt={message.expiresAt} />
        </div>
      </div>
    </li>
  );
}
