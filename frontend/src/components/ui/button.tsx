import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-primary-gradient text-white shadow-glass hover:shadow-lift',
  secondary: 'glass !rounded-tile text-primary-600 hover:shadow-lift',
  ghost: 'text-primary-600 hover:bg-primary-500/10',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
} as const;
const sizes = { md: 'h-11 px-5', sm: 'h-9 px-4 text-sm', icon: 'h-11 w-11' } as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-tile font-medium transition duration-200',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
