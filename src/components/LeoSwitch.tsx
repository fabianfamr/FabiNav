import React from 'react';
import { motion } from 'motion/react';

interface LeoSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export const LeoSwitch: React.FC<LeoSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  size = 'sm'
}) => {
  const trackSize = size === 'md' ? 'h-6 w-11' : 'h-5 w-9';
  const thumbSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const thumbOffset = size === 'md' ? (checked ? 'ml-6' : 'ml-1') : checked ? 'ml-[18px]' : 'ml-[3px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex ${trackSize} items-center rounded-full transition-colors duration-150 shrink-0 cursor-pointer ${
        checked ? 'bg-[var(--bn-accent)]' : 'bg-[var(--bn-active)]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 540, damping: 34 }}
        className={`inline-block ${thumbSize} rounded-full bg-white shadow-xs ${thumbOffset}`}
      />
    </button>
  );
};
