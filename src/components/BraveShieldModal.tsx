import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Lock, Shield, Cookie, ChevronDown } from 'lucide-react';
import { FabiShieldState, TlsInspectionResult } from '../types';
import { APP_VERSION } from '../constants/initialData';
import { LeoSwitch } from './LeoSwitch';

interface FabiShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onNavigate?: (url: string) => void;
}

const LEO_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const FabiShieldModal: React.FC<FabiShieldModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  shieldState,
  onUpdateShieldState,
  onNavigate
}) => {
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [tlsSummary, setTlsSummary] = useState<TlsInspectionResult | null>(null);

  const isExternal = currentUrl.startsWith('http://') || currentUrl.startsWith('https://');
  let domain = 'Nueva pestaña';
  try {
    if (isExternal) {
      domain = new URL(currentUrl).hostname;
    } else if (currentUrl.startsWith('fabinav://')) {
      domain = 'Página interna de FabiNav';
    }
  } catch {
    domain = currentUrl;
  }

  useEffect(() => {
    if (!isOpen || !isExternal) {
      setTlsSummary(null);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/tls?url=${encodeURIComponent(currentUrl)}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<TlsInspectionResult>) : null))
      .then((data) => {
        if (data) setTlsSummary(data);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [isOpen, isExternal, currentUrl]);

  useEffect(() => {
    if (!isOpen) return;
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
          id="fabinav-shields-modal"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.16, ease: LEO_EASE_OUT }}
          className="fixed top-20 right-4 sm:right-16 w-[360px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[var(--bn-text)] select-none text-xs rounded-2xl overflow-hidden origin-top-right"
        >
          {/* FabiNav Shields Header */}
          <div className="bg-[var(--bn-toolbar)] px-4 py-3 border-b border-[var(--bn-border)] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: shieldState.enabled
                    ? 'var(--leo-gradient-brand)'
                    : 'var(--bn-hover)'
                }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path
                    fill="#ffffff"
                    d="M12 2L4 5.2v5.9c0 5.1 3.4 9.7 8 10.9 4.6-1.2 8-5.8 8-10.9V5.2L12 2zm0 4.4l3.6 1.8-.9 3.6 1.1 2-3.8 3-3.8-3 1.1-2-.9-3.6L12 6.4z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-[var(--bn-text-strong)] flex items-center gap-1.5">
                  <span>Escudos y TLS</span>
                  <span className="text-[11px] text-[var(--bn-text-muted)] font-normal tabular-nums">
                    · v{APP_VERSION}
                  </span>
                </h4>
                <p className="text-[11px] text-[var(--bn-text-muted)] truncate" title={domain}>
                  {domain}
                  {tlsSummary?.protocol ? ` · ${tlsSummary.protocol}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar escudos"
              className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] p-1.5 rounded-full hover:bg-[var(--bn-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main FabiNav Shield Toggle */}
          <div className="p-4 flex items-center justify-between border-b border-[var(--bn-border)] bg-[var(--bn-surface-alt)]">
            <div className="flex flex-col pr-3">
              <span className="text-[13px] font-semibold text-[var(--bn-text-strong)]">
                {shieldState.enabled ? 'Protección activa' : 'Protección en pausa'}
              </span>
              <span className="text-[11px] text-[var(--bn-text-muted)] mt-0.5 leading-snug">
                {shieldState.enabled
                  ? 'Bloqueo de rastreadores, cookies entre sitios y verificación TLS'
                  : 'Las reglas de filtrado están pausadas en esta sesión'}
              </span>
            </div>

            <LeoSwitch
              size="md"
              checked={shieldState.enabled}
              onChange={(v) => onUpdateShieldState({ enabled: v })}
              ariaLabel="Activar o pausar escudos"
            />
          </div>

          {/* Real Counters */}
          <div className="p-3.5 bg-[var(--bn-surface)] border-b border-[var(--bn-border)] grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
              <div className="text-base font-semibold text-[var(--bn-accent)] leading-none tabular-nums font-mono">
                {shieldState.trackersBlockedCount}
              </div>
              <div className="text-[10px] text-[var(--bn-text-muted)] mt-1.5 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Rastreadores</span>
              </div>
            </div>
            <div className="p-2.5 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
              <div className="text-base font-semibold text-[var(--bn-text-strong)] leading-none tabular-nums font-mono">
                {shieldState.cookiesBlockedCount}
              </div>
              <div className="text-[10px] text-[var(--bn-text-muted)] mt-1.5 flex items-center justify-center gap-1">
                <Cookie className="w-3 h-3" />
                <span>Cookies bloq.</span>
              </div>
            </div>
            <div className="p-2.5 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
              <div className="text-base font-semibold text-[var(--bn-success-text)] leading-none tabular-nums font-mono">
                {shieldState.httpsUpgradesCount}
              </div>
              <div className="text-[10px] text-[var(--bn-text-muted)] mt-1.5 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                <span>HTTPS/TLS</span>
              </div>
            </div>
          </div>

          {/* Collapsible FabiNav Advanced Controls */}
          <div className="border-b border-[var(--bn-border)]">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
            >
              <span>Controles avanzados y TLS</span>
              <ChevronDown
                className={`w-4 h-4 text-[var(--bn-text-muted)] transition-transform duration-200 ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: LEO_EASE_OUT }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-[var(--bn-text)]">Bloqueo de rastreadores</span>
                      <select
                        value={shieldState.blockTrackersAndAds}
                        onChange={(e) =>
                          onUpdateShieldState({
                            blockTrackersAndAds: e.target.value as FabiShieldState['blockTrackersAndAds']
                          })
                        }
                        className="bg-[var(--bn-omnibox)] text-[var(--bn-text-strong)] border border-[var(--bn-border-strong)] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-[var(--bn-accent)]"
                      >
                        <option value="standard">Estándar</option>
                        <option value="aggressive">Agresivo</option>
                        <option value="disabled">Desactivado</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--bn-text)]">Actualizar conexiones a HTTPS</span>
                      <LeoSwitch
                        checked={shieldState.upgradeHttps}
                        onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                        ariaLabel="Actualizar conexiones a HTTPS"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--bn-text)]">Verificación TLS 1.2/1.3 estricta</span>
                      <LeoSwitch
                        checked={shieldState.strictTls}
                        onChange={(v) => onUpdateShieldState({ strictTls: v })}
                        ariaLabel="Verificación TLS estricta"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--bn-text)]">Bloquear cookies entre sitios</span>
                      <LeoSwitch
                        checked={shieldState.blockCrossSiteCookies}
                        onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                        ariaLabel="Bloquear cookies entre sitios"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--bn-text)]">Bloquear scripts en páginas</span>
                      <LeoSwitch
                        checked={shieldState.blockScripts}
                        onChange={(v) => onUpdateShieldState({ blockScripts: v })}
                        ariaLabel="Bloquear scripts"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-[var(--bn-text)]">Huella digital (Fingerprinting)</span>
                      <select
                        value={shieldState.blockFingerprinting}
                        onChange={(e) =>
                          onUpdateShieldState({
                            blockFingerprinting: e.target.value as FabiShieldState['blockFingerprinting']
                          })
                        }
                        className="bg-[var(--bn-omnibox)] text-[var(--bn-text-strong)] border border-[var(--bn-border-strong)] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-[var(--bn-accent)]"
                      >
                        <option value="standard">Estándar</option>
                        <option value="strict">Estricto</option>
                        <option value="disabled">Desactivado</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="bg-[var(--bn-toolbar)] px-4 py-2.5 flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('fabinav://shields');
                onClose();
              }}
              className="text-[var(--bn-accent)] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Ver cookies y protección TLS</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <span>FabiNav Shield</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const BraveShieldModal = FabiShieldModal;
