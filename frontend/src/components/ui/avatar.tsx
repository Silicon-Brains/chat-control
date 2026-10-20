import { cn, initials } from '@/lib/utils';

const palette = ['bg-primary-500', 'bg-accent-purple', 'bg-accent-pink', 'bg-accent-orange', 'bg-accent-slate'];
const pick = (s: string) => palette[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];

export function Avatar({
  name,
  icon,
  size = 40,
  className,
}: {
  name: string;
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: icon ? size * 0.58 : size * 0.38 }}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold text-white', pick(name), className)}
    >
      {icon ?? initials(name)}
    </span>
  );
}
