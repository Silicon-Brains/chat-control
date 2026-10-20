import Link from 'next/link';
import { cn } from '@/lib/utils';

export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass p-6', className)} {...props} />;
}

export function CardHeader({ title, href, actionLabel = 'View all' }: { title: string; href?: string; actionLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-medium leading-[22px]">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-primary-500 hover:text-primary-600">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
