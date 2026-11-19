import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Shield,
  Cookie,
  ChevronDown,
  Settings,
  Hand,
  Code2,
  Fingerprint,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { FabiShieldState, TlsInspectionResult } from '../types';
import { FabiSwitch } from './FabiSwitch';

interface FabiShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onNavigate?: (url: string) => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

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
      domain = new URL(currentUrl).hostname.replace(/^www\./, '');
    } else if (currentUrl.startsWith('fabinav://')) {
      domain = 'FabiNav interno';
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

  const totalBlocked =
    shieldState.trackersBlockedCount +
    shieldState.cookiesBlockedCount +
    shieldState.httpsUpgradesCount;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="fabinav-shields-modal"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
          className="fixed top-20 right-4 sm:right-16 w-[356px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[var(--bn-text)] select-none text-xs rounded-2xl overflow-hidden origin-top-right"
        >
          {/* Top Site Header + Main Shield Switch (matches reference layout) */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] flex items-center justify-center shrink-0">
                {isExternal ? (
                  <Globe className="w-4.5 h-4.5 text-[var(--bn-text-strong)]" />
                ) : (
                  <Shield className="w-4.5 h-4.5 text-[var(--bn-accent)]" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-[14px] font-semibold text-[var(--bn-text-strong)] truncate">
                  {domain}
                </h4>
                <p className="text-[12px] text-[var(--bn-text-muted)] leading-snug">
                  Escudos{' '}
                  <strong className="font-semibold text-[var(--bn-text-strong)]">
                    {shieldState.enabled ? 'activados' : 'desactivados'}
                  </strong>{' '}
                  para este sitio
                </p>
              </div>
            </div>

            <FabiSwitch
              size="md"
              checked={shieldState.enabled}
              onChange={(v) => onUpdateShieldState({ enabled: v })}
              ariaLabel="Activar o desactivar escudos"
            />
          </div>

          {/* Blocked Summary Box */}
          <div className="px-4 pb-3.5">
            <div className="rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] px-4 py-3 flex items-center gap-3.5">
              <span className="text-xl font-bold text-[var(--bn-text-strong)] tabular-nums shrink-0">
                {totalBlocked}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--bn-text)] leading-snug">
                  rastreadores, cookies y mejoras HTTPS bloqueados o aplicadas
                </p>
                {tlsSummary?.protocol && (
                  <p className="text-[10px] text-[var(--bn-success-text)] font-mono mt-0.5">
                    Conexión cifrada · {tlsSummary.protocol}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[var(--bn-border)]" />

          {/* Advanced Controls Accordion */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-[13px] font-medium text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
          >
            <span className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-[var(--bn-text-muted)]" />
              <span>Opciones avanzadas</span>
            </span>
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
                transition={{ duration: 0.18, ease: FABI_EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-2.5">
                  {/* Trackers & Ads Select Pill */}
                  <div className="flex items-center gap-3">
                    <Hand className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    <select
                      value={shieldState.blockTrackersAndAds}
                      onChange={(e) =>
                        onUpdateShieldState({
                          blockTrackersAndAds: e.target.value as FabiShieldState['blockTrackersAndAds']
                        })
                      }
                      aria-label="Bloquear rastreadores y anuncios"
                      className="flex-1 bg-[var(--bn-surface-alt)] text-[var(--bn-text-strong)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-[12px] focus:outline-none focus:border-[var(--bn-accent)] cursor-pointer"
                    >
                      <option value="standard">Bloquear rastreadores: Estándar</option>
                      <option value="aggressive">Bloquear rastreadores: Agresivo</option>
                      <option value="disabled">Rastreadores: Permitidos</option>
                    </select>
                  </div>

                  {/* HTTPS Upgrade Pill */}
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2">
                      <span className="text-[12px] text-[var(--bn-text-strong)]">
                        Actualizar conexiones a HTTPS
                      </span>
                      <FabiSwitch
                        checked={shieldState.upgradeHttps}
                        onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                        ariaLabel="Actualizar conexiones a HTTPS"
                      />
                    </div>
                  </div>

                  {/* Strict TLS Check */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="flex items-center gap-3 text-[12px] text-[var(--bn-text)]">
                      <ShieldCheck className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                      <span>Verificación TLS 1.2/1.3 estricta</span>
                    </span>
                    <FabiSwitch
                      checked={shieldState.strictTls}
                      onChange={(v) => onUpdateShieldState({ strictTls: v })}
                      ariaLabel="Verificación TLS estricta"
                    />
                  </div>

                  {/* Block Scripts Switch */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="flex items-center gap-3 text-[12px] text-[var(--bn-text)]">
                      <Code2 className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                      <span>Bloquear los scripts</span>
                    </span>
                    <FabiSwitch
                      checked={shieldState.blockScripts}
                      onChange={(v) => onUpdateShieldState({ blockScripts: v })}
                      ariaLabel="Bloquear los scripts"
                    />
                  </div>

                  {/* Fingerprinting Select */}
                  <div className="flex items-center gap-3">
                    <Fingerprint className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    <select
                      value={shieldState.blockFingerprinting}
                      onChange={(e) =>
                        onUpdateShieldState({
                          blockFingerprinting: e.target.value as FabiShieldState['blockFingerprinting']
                        })
                      }
                      aria-label="Bloquear huellas digitales"
                      className="flex-1 bg-[var(--bn-surface-alt)] text-[var(--bn-text-strong)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2 text-[12px] focus:outline-none focus:border-[var(--bn-accent)] cursor-pointer"
                    >
                      <option value="standard">Bloquear huellas digitales: Estándar</option>
                      <option value="strict">Bloquear huellas digitales: Estricto</option>
                      <option value="disabled">Huellas digitales: Permitidas</option>
                    </select>
                  </div>

                  {/* Cookies Toggle */}
                  <div className="flex items-center gap-3">
                    <Cookie className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                    <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-2">
                      <span className="text-[12px] text-[var(--bn-text-strong)]">
                        Bloquear cookies entre sitios
                      </span>
                      <FabiSwitch
                        checked={shieldState.blockCrossSiteCookies}
                        onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                        ariaLabel="Bloquear cookies entre sitios"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-[1px] bg-[var(--bn-border)]" />

          {/* Dual Outline Pill Buttons + FabiNav Note */}
          <div className="p-4 space-y-3 bg-[var(--bn-surface)]">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate('fabinav://shields');
                  onClose();
                }}
                className="py-2 px-3 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[12px] font-medium text-[var(--bn-text-strong)] transition-colors text-center"
              >
                Cookies y TLS
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate('fabinav://settings');
                  onClose();
                }}
                className="py-2 px-3 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[12px] font-medium text-[var(--bn-text-strong)] transition-colors text-center"
              >
                Configuración global
              </button>
            </div>

            <p className="text-[11px] text-[var(--bn-text-muted)] text-center leading-relaxed">
              Si este sitio parece estar dañado, prueba desactivar los Escudos. Esto puede reducir las
              protecciones de privacidad de FabiNav.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
