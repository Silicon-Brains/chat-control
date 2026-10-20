import { cn } from '@/lib/utils';

const tones = {
  teal: 'bg-primary-500/15 text-primary-600',
  solid: 'bg-primary-500 text-white',
  purple: 'bg-accent-purple/15 text-accent-purple',
  pink: 'bg-accent-pink/15 text-accent-pink',
  orange: 'bg-warning/20 text-[#B86E1F]',
  danger: 'bg-danger/15 text-[#B8434D]',
  neutral: 'bg-ink-400/15 text-ink-600',
} as const;

export function Badge({ tone = 'teal', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  );
}
