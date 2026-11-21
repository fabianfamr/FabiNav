import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Shield,
  Cookie,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowLeft,
  Settings,
  Hand,
  Code2,
  Fingerprint,
  Globe,
  ShieldCheck,
  Eraser
} from 'lucide-react';
import { AppLanguage, FabiShieldState, TlsInspectionResult } from '../types';
import { FabiSwitch } from './FabiSwitch';
import { t } from '../i18n/translations';

interface FabiShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  language?: AppLanguage;
  blockedTrackerUrls?: string[];
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>) => void;
  onNavigate?: (url: string) => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const FabiShieldModal: React.FC<FabiShieldModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  language = 'es',
  blockedTrackerUrls = [],
  shieldState,
  onUpdateShieldState,
  onNavigate
}) => {
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [viewMode, setViewMode] = useState<'main' | 'trackers'>('main');
  const [tlsSummary, setTlsSummary] = useState<TlsInspectionResult | null>(null);
  const [faviconError, setFaviconError] = useState(false);

  const isExternal = currentUrl.startsWith('http://') || currentUrl.startsWith('https://');
  let domain = t(language, 'newTab');
  try {
    if (isExternal) {
      domain = new URL(currentUrl).hostname.replace(/^www\./, '').toLowerCase();
    } else if (currentUrl.startsWith('fabinav://')) {
      domain = 'FabiNav';
    }
  } catch {
    domain = currentUrl;
  }

  useEffect(() => {
    setFaviconError(false);
  }, [domain]);

  useEffect(() => {
    if (!isOpen) {
      setViewMode('main');
    }
  }, [isOpen]);

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
      if (e.key === 'Escape') {
        if (viewMode === 'trackers') {
          setViewMode('main');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, viewMode]);

  const pageTrackersCount = blockedTrackerUrls.length;
  const displayBlockedCount = isExternal ? pageTrackersCount : 0;
  const totalAllTimeBlocked =
    shieldState.trackersBlockedCount +
    shieldState.cookiesBlockedCount +
    shieldState.httpsUpgradesCount;

  const forgetList = shieldState.forgetOnCloseDomains || [];
  const isForgetEnabled = isExternal && forgetList.includes(domain);

  const handleToggleForgetSite = (nextVal: boolean) => {
    if (!isExternal) return;
    const nextList = nextVal
      ? Array.from(new Set([...forgetList, domain]))
      : forgetList.filter((d) => d !== domain);
    onUpdateShieldState({ forgetOnCloseDomains: nextList });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="fabinav-shields-modal"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.16, ease: FABI_EASE_OUT }}
          className="fixed top-20 right-4 sm:right-16 w-[368px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[var(--bn-text)] select-none text-xs rounded-2xl overflow-hidden origin-top-right"
        >
          <AnimatePresence mode="wait" initial={false}>
            {viewMode === 'trackers' ? (
              <motion.div
                key="trackers-detail"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.15, ease: FABI_EASE_OUT }}
                className="flex flex-col max-h-[460px]"
              >
                {/* Header matching Brave Shields blocked trackers subview */}
                <div className="px-4 py-3.5 border-b border-[var(--bn-border)] flex items-start gap-3 bg-[var(--bn-surface)]">
                  <button
                    type="button"
                    onClick={() => setViewMode('main')}
                    aria-label="Volver"
                    className="mt-0.5 p-1 -ml-1 rounded-full hover:bg-[var(--bn-hover)] text-[var(--bn-text-strong)] transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-semibold text-[var(--bn-text-strong)] leading-tight tabular-nums">
                      {t(language, 'trackersDetailTitle')} ({pageTrackersCount})
                    </h4>
                    <p className="text-[12px] text-[var(--bn-text-muted)] truncate mt-0.5">
                      {domain}
                    </p>
                  </div>
                </div>

                {/* Bullet list of real blocked URLs */}
                <div className="p-4 overflow-y-auto flex-1 bg-[var(--bn-surface-alt)]/45">
                  {!isExternal ? (
                    <p className="text-[12px] text-[var(--bn-text-muted)] leading-relaxed">
                      {t(language, 'trackersInternalNote')}
                    </p>
                  ) : blockedTrackerUrls.length === 0 ? (
                    <p className="text-[12px] text-[var(--bn-text-muted)] leading-relaxed">
                      {t(language, 'trackersEmptyState')}
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {blockedTrackerUrls.map((blockedUrl) => (
                        <li
                          key={blockedUrl}
                          title={blockedUrl}
                          className="flex items-start gap-2.5 text-[12px] text-[var(--bn-text-strong)] leading-snug"
                        >
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--bn-text-muted)] shrink-0" />
                          <span className="break-all font-mono text-[11px] text-[var(--bn-text)]">
                            {blockedUrl}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="main-shields"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.15, ease: FABI_EASE_OUT }}
              >
                {/* Top Site Header + Master Switch */}
                <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] flex items-center justify-center shrink-0 overflow-hidden">
                      {isExternal && !faviconError ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
                          alt=""
                          onError={() => setFaviconError(true)}
                          className="w-5 h-5 object-contain"
                        />
                      ) : isExternal ? (
                        <Globe className="w-4 h-4 text-[var(--bn-text-strong)]" />
                      ) : (
                        <Shield className="w-4 h-4 text-[var(--bn-accent)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-semibold text-[var(--bn-text-strong)] truncate">
                        {domain}
                      </h4>
                      <p className="text-[12px] text-[var(--bn-text-muted)] leading-snug">
                        {t(language, 'shieldsStatusPrefix')}{' '}
                        <strong className="font-semibold text-[var(--bn-text-strong)]">
                          {shieldState.enabled
                            ? t(language, 'shieldsEnabledForSite')
                            : t(language, 'shieldsDisabledForSite')}
                        </strong>{' '}
                        {t(language, 'shieldsStatusSuffix')}
                      </p>
                    </div>
                  </div>

                  <FabiSwitch
                    size="md"
                    checked={shieldState.enabled}
                    onChange={(v) => onUpdateShieldState({ enabled: v })}
                    ariaLabel="Shields switch"
                  />
                </div>

                {/* Blocked Summary Box (Live per-site counter) */}
                <div className="px-4 pb-3.5">
                  <div className="rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] px-4 py-3 flex items-center gap-3.5">
                    <span className="text-2xl font-bold text-[var(--bn-text-strong)] tabular-nums shrink-0 leading-none">
                      {displayBlockedCount}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-[var(--bn-text)] leading-snug">
                        {t(language, 'shieldsBlockedSummary')}
                      </p>
                      <p className="text-[10px] text-[var(--bn-text-muted)] mt-1 tabular-nums truncate">
                        {isExternal ? t(language, 'shieldsLivePageNote') : t(language, 'trackersInternalNote')}
                        {' · '}
                        {t(language, 'shieldsSessionTotalLabel')}: {totalAllTimeBlocked}
                      </p>
                      {tlsSummary?.protocol && (
                        <p className="text-[10px] text-[var(--bn-success-text)] font-mono mt-0.5 truncate">
                          {t(language, 'tlsVerified')} · {tlsSummary.protocol}
                          {tlsSummary.cipher ? ` · ${tlsSummary.cipher}` : ''}
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
                  className="w-full px-4 py-2.5 flex items-center justify-between text-[12px] font-medium text-[var(--bn-text-strong)] hover:bg-[var(--bn-hover)] transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-[var(--bn-text-muted)]" />
                    <span>{t(language, 'advancedOptions')}</span>
                  </span>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-[var(--bn-text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--bn-text-muted)]" />
                  )}
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
                      <div className="px-4 pb-3.5 pt-1 space-y-2">
                        {/* Trackers & Ads Select Pill + Counter + Detail Chevron Button */}
                        <div className="flex items-center gap-2">
                          <Hand className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                          <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-2.5 py-1.5">
                            <select
                              value={shieldState.blockTrackersAndAds}
                              onChange={(e) =>
                                onUpdateShieldState({
                                  blockTrackersAndAds: e.target
                                    .value as FabiShieldState['blockTrackersAndAds']
                                })
                              }
                              aria-label={t(language, 'blockTrackersStandard')}
                              className="flex-1 min-w-0 bg-transparent text-[var(--bn-text-strong)] text-[12px] focus:outline-none cursor-pointer truncate"
                            >
                              <option value="standard" className="bg-[var(--bn-surface)]">
                                {t(language, 'blockTrackersStandard')}
                              </option>
                              <option value="aggressive" className="bg-[var(--bn-surface)]">
                                {t(language, 'blockTrackersAggressive')}
                              </option>
                              <option value="disabled" className="bg-[var(--bn-surface)]">
                                {t(language, 'blockTrackersDisabled')}
                              </option>
                            </select>
                            {isExternal && pageTrackersCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--bn-surface)] border border-[var(--bn-border)] text-[11px] font-mono tabular-nums text-[var(--bn-text-strong)] shrink-0">
                                {pageTrackersCount}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewMode('trackers')}
                            title={t(language, 'viewBlockedTrackersTooltip')}
                            aria-label={t(language, 'viewBlockedTrackersTooltip')}
                            className="w-7 h-7 rounded-lg bg-[var(--bn-surface-alt)] hover:bg-[var(--bn-hover)] border border-[var(--bn-border-strong)] flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-colors shrink-0"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* HTTPS Upgrade Pill */}
                        <div className="flex items-center gap-2.5">
                          <Lock className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                          <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                            <span className="text-[12px] text-[var(--bn-text-strong)]">
                              {t(language, 'upgradeToHttps')}
                            </span>
                            <FabiSwitch
                              checked={shieldState.upgradeHttps}
                              onChange={(v) => onUpdateShieldState({ upgradeHttps: v })}
                              ariaLabel={t(language, 'upgradeToHttps')}
                            />
                          </div>
                        </div>

                        {/* Strict TLS Check */}
                        <div className="flex items-center justify-between gap-2.5 py-1 px-0.5">
                          <span className="flex items-center gap-2.5 text-[12px] text-[var(--bn-text)]">
                            <ShieldCheck className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                            <span>{t(language, 'strictTlsCheck')}</span>
                          </span>
                          <FabiSwitch
                            checked={shieldState.strictTls}
                            onChange={(v) => onUpdateShieldState({ strictTls: v })}
                            ariaLabel={t(language, 'strictTlsCheck')}
                          />
                        </div>

                        {/* Block Scripts Switch */}
                        <div className="flex items-center justify-between gap-2.5 py-1 px-0.5">
                          <span className="flex items-center gap-2.5 text-[12px] text-[var(--bn-text)]">
                            <Code2 className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                            <span>{t(language, 'blockScripts')}</span>
                          </span>
                          <FabiSwitch
                            checked={shieldState.blockScripts}
                            onChange={(v) => onUpdateShieldState({ blockScripts: v })}
                            ariaLabel={t(language, 'blockScripts')}
                          />
                        </div>

                        {/* Fingerprinting Select Pill */}
                        <div className="flex items-center gap-2.5">
                          <Fingerprint className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                          <div className="flex-1 flex items-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                            <select
                              value={shieldState.blockFingerprinting}
                              onChange={(e) =>
                                onUpdateShieldState({
                                  blockFingerprinting: e.target
                                    .value as FabiShieldState['blockFingerprinting']
                                })
                              }
                              aria-label={t(language, 'fpStandard')}
                              className="flex-1 bg-transparent text-[var(--bn-text-strong)] text-[12px] focus:outline-none cursor-pointer"
                            >
                              <option value="standard" className="bg-[var(--bn-surface)]">
                                {t(language, 'fpStandard')}
                              </option>
                              <option value="strict" className="bg-[var(--bn-surface)]">
                                {t(language, 'fpStrict')}
                              </option>
                              <option value="disabled" className="bg-[var(--bn-surface)]">
                                {t(language, 'fpDisabled')}
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Third-party Cookies Pill */}
                        <div className="flex items-center gap-2.5">
                          <Cookie className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                          <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                            <span className="text-[12px] text-[var(--bn-text-strong)]">
                              {t(language, 'blockThirdPartyCookies')}
                            </span>
                            <FabiSwitch
                              checked={shieldState.blockCrossSiteCookies}
                              onChange={(v) => onUpdateShieldState({ blockCrossSiteCookies: v })}
                              ariaLabel={t(language, 'blockThirdPartyCookies')}
                            />
                          </div>
                        </div>

                        {/* Forget Me When I Close This Site */}
                        <div className="flex items-center justify-between gap-2.5 py-1 px-0.5">
                          <span className="flex items-center gap-2.5 text-[12px] text-[var(--bn-text)]">
                            <Eraser className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                            <span>{t(language, 'forgetMeOnClose')}</span>
                          </span>
                          <FabiSwitch
                            checked={isForgetEnabled}
                            onChange={handleToggleForgetSite}
                            disabled={!isExternal}
                            ariaLabel={t(language, 'forgetMeOnClose')}
                          />
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
                        if (onNavigate) onNavigate('fabinav://shields#filtros');
                        onClose();
                      }}
                      className="py-2 px-3 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[12px] font-medium text-[var(--bn-text-strong)] transition-colors text-center"
                    >
                      {t(language, 'filterListsBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigate) onNavigate('fabinav://settings#escudos');
                        onClose();
                      }}
                      className="py-2 px-3 rounded-full border border-[var(--bn-border-strong)] hover:bg-[var(--bn-hover)] text-[12px] font-medium text-[var(--bn-text-strong)] transition-colors text-center"
                    >
                      {t(language, 'globalSettingsBtn')}
                    </button>
                  </div>

                  <p className="text-[11px] text-[var(--bn-text-muted)] text-center leading-relaxed">
                    {t(language, 'shieldsBrokenNote')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
