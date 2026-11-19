import React from 'react';
import { motion } from 'motion/react';

interface FabiSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const FabiSwitch: React.FC<FabiSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  size = 'sm',
  disabled = false
}) => {
  const trackCls = size === 'md' ? 'w-10 h-[22px]' : 'w-8 h-[18px]';
  const knobSize = size === 'md' ? 16 : 12;
  const shiftX = size === 'md' ? 18 : 14;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center shrink-0 rounded-full p-[3px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--bn-accent)] focus-visible:outline-offset-2 disabled:opacity-45 cursor-pointer ${trackCls} ${
        checked
          ? 'bg-[var(--bn-accent)]'
          : 'bg-[var(--bn-hover)] border border-[var(--bn-border-strong)]'
      }`}
    >
      <motion.span
        animate={{ x: checked ? shiftX : 0 }}
        transition={{ type: 'spring', stiffness: 540, damping: 32 }}
        style={{ width: knobSize, height: knobSize }}
        className="block rounded-full bg-white shadow-xs"
      />
    </button>
  );
};
