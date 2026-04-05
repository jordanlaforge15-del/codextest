import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './ui/utils';

type ButtonVariant = 'primary' | 'secondary' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed',
  link: 'bg-transparent text-gray-600 underline underline-offset-2 hover:text-gray-900'
};

export function Button({
  className,
  children,
  icon,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
