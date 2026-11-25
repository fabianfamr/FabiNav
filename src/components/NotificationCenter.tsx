import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { PendingNotificationPermission } from '../types';

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.17);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.09);
    gain2.gain.setValueAtTime(0.0001, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.055, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.3);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // ignore audio autoplay restrictions
  }
}

function formatHost(originOrUrl: string): string {
  try {
    return new URL(originOrUrl).hostname.replace(/^www\./, '') || originOrUrl;
  } catch {
    return originOrUrl || 'Sitio web';
  }
}

interface NotificationPermissionPromptProps {
  pending: PendingNotificationPermission | null;
  onRespond: (granted: boolean) => void;
  onDismiss: () => void;
}

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  pending,
  onRespond,
  onDismiss
}) => {
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key={pending.id}
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
          className="fixed top-[92px] left-5 z-50 w-[340px] max-w-[92vw] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl p-4 space-y-3 text-xs text-[var(--bn-text)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--bn-accent-soft)] text-[var(--bn-accent)] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--bn-text-strong)] truncate">
                  {formatHost(pending.origin)}
                </div>
                <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5 leading-snug">
                  Quiere enviarte notificaciones de Windows cuando haya novedades.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              title="Decidir más tarde"
              className="p-1 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onRespond(false)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] font-medium transition-colors"
            >
              Bloquear
            </button>
            <button
              type="button"
              onClick={() => onRespond(true)}
              className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white font-medium transition-colors"
            >
              Permitir
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
