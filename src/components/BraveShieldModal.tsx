import React from 'react';
import { ShieldCheck, ShieldOff, X, ExternalLink, Lock, Ban } from 'lucide-react';
import { FabiShieldState } from '../types';
import { APP_VERSION } from '../constants/initialData';

interface FabiShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onNavigate?: (url: string) => void;
}

export const FabiShieldModal: React.FC<FabiShieldModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  shieldState,
  onUpdateShieldState,
  onNavigate
}) => {
  if (!isOpen) return null;

  let domain = 'Nueva pestaña';
  try {
    if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
      const urlObj = new URL(currentUrl);
      domain = urlObj.hostname;
    } else if (currentUrl.startsWith('fabinav://')) {
      domain = 'Página interna de FabiNav';
    }
  } catch {
    domain = currentUrl;
  }

  return (
    <div
      id="fabinav-shields-modal"
      className="fixed top-20 right-4 sm:right-16 w-[340px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[var(--bn-text)] select-none text-xs rounded-2xl overflow-hidden"
    >
      {/* Brave Shields Header */}
      <div className="bg-[var(--bn-toolbar)] px-4 py-3 border-b border-[var(--bn-border)] flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              shieldState.enabled
                ? 'bg-[var(--bn-accent)] text-white'
                : 'bg-[var(--bn-hover)] text-[var(--bn-text-muted)]'
            }`}
          >
            {shieldState.enabled ? (
              <ShieldCheck className="w-4.5 h-4.5" />
            ) : (
              <ShieldOff className="w-4.5 h-4.5" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-[var(--bn-text-strong)] flex items-center gap-1.5">
              <span>Escudos de FabiNav</span>
              <span className="text-[10px] font-mono text-[var(--bn-text-muted)] tabular-nums">
                v{APP_VERSION}
              </span>
            </h4>
            <p className="text-[11px] text-[var(--bn-text-muted)] truncate font-mono" title={domain}>
              {domain}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] p-1.5 rounded-full hover:bg-[var(--bn-hover)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Brave-style Toggle */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--bn-border)] bg-[var(--bn-surface-alt)]">
        <div className="flex flex-col pr-3">
          <span className="text-[13px] font-semibold text-[var(--bn-text-strong)]">
            {shieldState.enabled ? 'Los escudos están activos' : 'Los escudos están desactivados'}
          </span>
          <span className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
            {shieldState.enabled
              ? 'Actualización automática a HTTPS y reglas de privacidad locales'
              : 'La protección está en pausa para la sesión actual'}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={shieldState.enabled}
          onClick={() => onUpdateShieldState({ enabled: !shieldState.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            shieldState.enabled ? 'bg-[var(--bn-accent)]' : 'bg-[var(--bn-active)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              shieldState.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Real Session Counters */}
      <div className="p-3.5 bg-[var(--bn-surface)] border-b border-[var(--bn-border)] grid grid-cols-2 gap-2.5 text-center">
        <div className="p-2.5 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
          <div className="text-lg font-semibold text-[var(--bn-accent)] leading-none tabular-nums font-mono">
            {shieldState.httpsUpgradesCount}
          </div>
          <div className="text-[11px] text-[var(--bn-text-muted)] mt-1.5 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Mejoras HTTPS</span>
          </div>
        </div>
        <div className="p-2.5 bg-[var(--bn-surface-alt)] rounded-xl border border-[var(--bn-border)]">
          <div className="text-lg font-semibold text-[var(--bn-text-strong)] leading-none tabular-nums font-mono">
            {shieldState.trackersBlockedCount}
          </div>
          <div className="text-[11px] text-[var(--bn-text-muted)] mt-1.5 flex items-center justify-center gap-1">
            <Ban className="w-3 h-3" />
            <span>Rastreadores</span>
          </div>
        </div>
      </div>

      {/* Brave-style Shield Controls */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-[var(--bn-text)]">Bloqueo de rastreadores y anuncios</span>
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

        <label className="flex items-center justify-between text-xs cursor-pointer">
          <span className="text-[var(--bn-text)]">Actualizar conexiones a HTTPS</span>
          <input
            type="checkbox"
            checked={shieldState.upgradeHttps}
            onChange={(e) => onUpdateShieldState({ upgradeHttps: e.target.checked })}
            className="accent-[var(--bn-accent)] w-4 h-4 rounded"
          />
        </label>

        <label className="flex items-center justify-between text-xs cursor-pointer">
          <span className="text-[var(--bn-text)]">Bloquear scripts de terceros</span>
          <input
            type="checkbox"
            checked={shieldState.blockScripts}
            onChange={(e) => onUpdateShieldState({ blockScripts: e.target.checked })}
            className="accent-[var(--bn-accent)] w-4 h-4 rounded"
          />
        </label>

        <label className="flex items-center justify-between text-xs cursor-pointer">
          <span className="text-[var(--bn-text)]">Bloquear cookies entre sitios</span>
          <input
            type="checkbox"
            checked={shieldState.blockCrossSiteCookies}
            onChange={(e) => onUpdateShieldState({ blockCrossSiteCookies: e.target.checked })}
            className="accent-[var(--bn-accent)] w-4 h-4 rounded"
          />
        </label>

        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-[var(--bn-text)]">Bloqueo de huella digital</span>
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

      {/* Footer */}
      <div className="bg-[var(--bn-toolbar)] px-4 py-2.5 border-t border-[var(--bn-border)] flex items-center justify-between text-[11px] text-[var(--bn-text-muted)]">
        <button
          type="button"
          onClick={() => {
            if (onNavigate) onNavigate('fabinav://shields');
            onClose();
          }}
          className="text-[var(--bn-accent)] hover:underline flex items-center gap-1 font-medium"
        >
          <span>Ajustes globales de escudos</span>
          <ExternalLink className="w-3 h-3" />
        </button>
        <span>Motor Electron</span>
      </div>
    </div>
  );
};

export const BraveShieldModal = FabiShieldModal;
