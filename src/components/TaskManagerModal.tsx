import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Globe, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { WebTab, FabiShieldState } from '../types';

interface TaskManagerModalProps {
  isOpen: boolean;
  tabs: WebTab[];
  activeTabId: string;
  shieldState: FabiShieldState;
  networkCount: number;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const TaskManagerModal: React.FC<TaskManagerModalProps> = ({
  isOpen,
  tabs,
  activeTabId,
  shieldState,
  networkCount,
  onSelectTab,
  onCloseTab,
  onClose
}) => {
  const [heapMb, setHeapMb] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
    };
    if (perf.memory?.usedJSHeapSize) {
      setHeapMb(`${(perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`);
    } else {
      setHeapMb(null);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: FABI_EASE_OUT }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] rounded-2xl shadow-2xl text-[var(--bn-text)] overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--bn-text-strong)]">
                <Activity className="w-4 h-4 text-[var(--bn-accent)]" />
                <span>Administrador de tareas — FabiNav</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-3 gap-2.5 border-b border-[var(--bn-border)] bg-[var(--bn-surface-alt)] text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--bn-surface)] border border-[var(--bn-border)]">
                <div className="text-[11px] text-[var(--bn-text-muted)]">Pestañas activas</div>
                <div className="text-base font-semibold text-[var(--bn-text-strong)] tabular-nums mt-0.5">
                  {tabs.length}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bn-surface)] border border-[var(--bn-border)]">
                <div className="text-[11px] text-[var(--bn-text-muted)]">Peticiones de red</div>
                <div className="text-base font-semibold text-[var(--bn-text-strong)] tabular-nums mt-0.5">
                  {networkCount}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bn-surface)] border border-[var(--bn-border)]">
                <div className="text-[11px] text-[var(--bn-text-muted)]">
                  {heapMb ? 'Memoria JS' : 'Escudos / HTTPS'}
                </div>
                <div className="text-base font-semibold text-[var(--bn-success-text)] tabular-nums mt-0.5">
                  {heapMb || `${shieldState.httpsUpgradesCount} TLS`}
                </div>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--bn-border)] text-xs">
              <div className="px-4 py-2 bg-[var(--bn-surface)] flex items-center justify-between text-[11px] font-medium text-[var(--bn-text-muted)]">
                <span>Proceso / Pestaña</span>
                <span>Estado y acciones</span>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between bg-[var(--bn-surface)]/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[var(--bn-accent)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--bn-text-strong)]">
                      Núcleo FabiNav &amp; Escudos
                    </div>
                    <div className="text-[11px] text-[var(--bn-text-muted)]">
                      {shieldState.trackersBlockedCount + shieldState.cookiesBlockedCount} elementos bloqueados
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[var(--bn-success-text)]">Activo</span>
              </div>

              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 ${
                      isActive ? 'bg-[var(--bn-accent-soft)]/50' : 'hover:bg-[var(--bn-hover)]/45'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTab(tab.id);
                        onClose();
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                    >
                      {tab.tabMode === 'private' ? (
                        <Lock className="w-3.5 h-3.5 text-[var(--bn-private-text)] shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-[var(--bn-text-muted)] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--bn-text-strong)] truncate">
                          {tab.title || 'Nueva pestaña'}
                          {isActive ? ' · Actual' : ''}
                        </div>
                        <div className="text-[11px] text-[var(--bn-text-muted)] truncate font-mono">
                          {tab.url}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-[var(--bn-text-muted)]">
                        {tab.tabMode === 'private' ? 'Privada' : 'Normal'}
                      </span>
                      {(!tab.isPinned || tabs.length === 1) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (tabs.length <= 1) onClose();
                            onCloseTab(tab.id);
                          }}
                          title={tabs.length === 1 ? 'Cerrar pestaña y navegador' : 'Finalizar pestaña'}
                          className="p-1.5 rounded-full text-[var(--bn-text-muted)] hover:text-[var(--bn-danger-text)] hover:bg-[var(--bn-hover)] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2.5 bg-[var(--bn-toolbar)] border-t border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
              <span>Haz clic en una pestaña para enfocarla</span>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1 rounded-full bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] text-[var(--bn-text-strong)] font-medium"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
