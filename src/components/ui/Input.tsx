import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-[28px] w-full rounded-[4px] border border-[#2e3740] bg-[#161c22] px-2.5 font-sans text-[12px] text-[#f0f3fa] placeholder:text-[#687383]',
          'shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all focus:border-[#445060] focus:bg-[#1a2128] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/25 disabled:opacity-35 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
    );
  },
);
