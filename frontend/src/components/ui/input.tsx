import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, className, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-err` : helper ? `${inputId}-help` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11 w-full rounded-field border border-white/70 bg-white/[0.45] px-4 text-ink-900 placeholder:text-ink-400',
          'backdrop-blur transition focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(62,140,143,0.15)]',
          error && 'border-danger focus:border-danger focus-visible:ring-danger',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-err`} role="alert" className="text-sm text-danger">{error}</p>
      ) : helper ? (
        <p id={`${inputId}-help`} className="text-sm text-ink-600">{helper}</p>
      ) : null}
    </div>
  );
});
