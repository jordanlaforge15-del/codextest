import type { ButtonHTMLAttributes } from 'react';
import { cn } from './ui/utils';

interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
  label: string;
}

export function SidebarItem({
  active = false,
  className,
  count,
  label,
  type = 'button',
  ...props
}: SidebarItemProps) {
  return (
    <button
      type={type}
      className={cn(
        'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700',
        className
      )}
      {...props}
    >
      <span>{label}</span>
      <span className="ml-2 text-xs text-gray-400">({count ?? 0})</span>
    </button>
  );
}
