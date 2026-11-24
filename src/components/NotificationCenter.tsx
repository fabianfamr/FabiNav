import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  Globe,
  Settings,
  Trash2,
  VolumeX,
  X
} from 'lucide-react';
import { BrowserNotificationItem, PendingNotificationPermission } from '../types';

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

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 15) return 'ahora';
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  return new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

interface NotificationBellButtonProps {
  notifications: BrowserNotificationItem[];
  doNotDisturb: boolean;
  onToggleDoNotDisturb: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onRemoveOne: (id: string) => void;
  onSelectNotification: (item: BrowserNotificationItem) => void;
  onBlockOrigin: (origin: string) => void;
  onOpenSettings: () => void;
  onSendTestNotification: () => void;
}

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({
  notifications,
  doNotDisturb,
  onToggleDoNotDisturb,
  onMarkAllRead,
  onClearAll,
  onRemoveOne,
  onSelectNotification,
  onBlockOrigin,
  onOpenSettings,
  onSendTestNotification
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title={
          doNotDisturb
            ? 'Notificaciones en modo No molestar'
            : unreadCount > 0
            ? `Notificaciones de páginas (${unreadCount} sin leer)`
            : 'Centro de notificaciones de páginas'
        }
        aria-label="Centro de notificaciones de páginas"
        className={`relative w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all fabi-transition-xs ${
          isOpen
            ? 'bg-[var(--bn-hover)] text-[var(--bn-text-strong)]'
            : unreadCount > 0 && !doNotDisturb
            ? 'text-[var(--bn-accent)] hover:bg-[var(--bn-hover)]'
            : 'text-[var(--bn-text)] hover:bg-[var(--bn-hover)]'
        }`}
      >
        {doNotDisturb ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {unreadCount > 0 && !doNotDisturb && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--bn-accent)] text-white text-[9px] font-semibold leading-none flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
            className="absolute right-0 top-full mt-2 w-[360px] max-w-[92vw] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl overflow-hidden z-50 text-xs text-[var(--bn-text)]"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm text-[var(--bn-text-strong)]">
                  Notificaciones
                </span>
                {unreadCount > 0 && (
                  <span className="text-[11px] text-[var(--bn-text-muted)] tabular-nums">
                    · {unreadCount} sin leer
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleDoNotDisturb}
                  title={doNotDisturb ? 'Reactivar alertas emergentes' : 'Activar No molestar'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    doNotDisturb
                      ? 'bg-[var(--bn-accent-soft)] text-[var(--bn-accent)]'
                      : 'text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]'
                  }`}
                >
                  {doNotDisturb ? 'No molestar: Sí' : 'No molestar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setIsOpen(false);
                  }}
                  title="Configurar notificaciones por sitio"
                  className="p-1.5 rounded-lg text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            {notifications.length === 0 ? (
              <div className="px-5 py-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl mx-auto bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] flex items-center justify-center text-[var(--bn-text-muted)]">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--bn-text-strong)]">
                    Sin notificaciones recientes
                  </p>
                  <p className="text-[11px] text-[var(--bn-text-muted)] leading-relaxed">
                    Cuando una página web envíe una alerta autorizada, la verás aquí y en pantalla.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSendTestNotification();
                  }}
                  className="px-4 py-1.5 rounded-full bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border)] text-[11px] font-medium text-[var(--bn-text-strong)] transition-colors"
                >
                  Probar notificación
                </button>
              </div>
            ) : (
              <>
                <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--bn-border)]">
                  {notifications.map((item) => {
                    const host = formatHost(item.origin || item.url || '');
                    return (
                      <div
                        key={item.id}
                        className={`group px-4 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--bn-hover)]/65 ${
                          item.read ? 'opacity-80' : 'bg-[var(--bn-surface-alt)]/55'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--bn-omnibox)] border border-[var(--bn-border)] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                          {item.icon ? (
                            <img
                              src={item.icon}
                              alt={host}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Globe className="w-4 h-4 text-[var(--bn-accent)]" />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectNotification(item);
                            setIsOpen(false);
                          }}
                          className="flex-1 min-w-0 text-left space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--bn-text-muted)]">
                            <span className="truncate font-medium text-[var(--bn-text)]">{host}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums shrink-0">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                            {!item.read && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--bn-accent)] font-medium shrink-0">
                                  Nueva
                                </span>
                              </>
                            )}
                          </div>
                          <div className="font-semibold text-[var(--bn-text-strong)] truncate">
                            {item.title}
                          </div>
                          {item.body && (
                            <p className="text-[11px] text-[var(--bn-text-muted)] line-clamp-2 leading-snug">
                              {item.body}
                            </p>
                          )}
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onBlockOrigin(item.origin)}
                            title={`Silenciar notificaciones de ${host}`}
                            className="p-1 rounded-lg text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] hover:bg-[var(--bn-hover)]"
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveOne(item.id)}
                            title="Eliminar alerta"
                            className="p-1 rounded-lg text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-3.5 py-2.5 bg-[var(--bn-toolbar)]/75 border-t border-[var(--bn-border)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    disabled={unreadCount === 0}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--bn-text)] hover:bg-[var(--bn-hover)] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Marcar todo leído</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--bn-danger-text)] hover:bg-[var(--bn-hover)] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar todo</span>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
                  Quiere mostrarte notificaciones del navegador cuando haya novedades.
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

interface NotificationAlertStackProps {
  alerts: BrowserNotificationItem[];
  onDismiss: (id: string) => void;
  onOpen: (item: BrowserNotificationItem) => void;
  onSilenceOrigin: (origin: string) => void;
}

export const NotificationAlertStack: React.FC<NotificationAlertStackProps> = ({
  alerts,
  onDismiss,
  onOpen,
  onSilenceOrigin
}) => {
  if (alerts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-[92px] right-4 z-50 w-[340px] max-w-[92vw] flex flex-col gap-2.5 pointer-events-none"
    >
      <AnimatePresence>
        {alerts.slice(0, 3).map((item) => {
          const host = formatHost(item.origin || item.url || '');
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.18, ease: FABI_EASE_OUT }}
              className="pointer-events-auto bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl p-3.5 text-xs text-[var(--bn-text)]"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--bn-omnibox)] border border-[var(--bn-border)] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                  {item.icon ? (
                    <img
                      src={item.icon}
                      alt={host}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Bell className="w-4 h-4 text-[var(--bn-accent)]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--bn-text-muted)] min-w-0">
                      <span className="truncate font-medium text-[var(--bn-text)]">{host}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">ahora</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDismiss(item.id)}
                      title="Cerrar alerta"
                      className="p-0.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="w-full text-left mt-1 group"
                  >
                    <div className="font-semibold text-[var(--bn-text-strong)] truncate group-hover:text-[var(--bn-accent)] transition-colors">
                      {item.title}
                    </div>
                    {item.body && (
                      <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5 line-clamp-2 leading-snug">
                        {item.body}
                      </p>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--bn-border)]">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="text-[11px] font-medium text-[var(--bn-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir página</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSilenceOrigin(item.origin)}
                      className="text-[11px] text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] transition-colors"
                    >
                      Silenciar sitio
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
