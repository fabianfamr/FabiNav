import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  ShieldOff,
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
  Eraser,
  RotateCcw
} from 'lucide-react';
import { AppLanguage, FabiShieldState, TlsInspectionResult } from '../types';
import { FabiSwitch } from './FabiSwitch';
import { t } from '../i18n/translations';
import { resolveEffectiveShield } from '../utils/shields';

interface FabiShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  language?: AppLanguage;
  blockedTrackerUrls?: string[];
  shieldState: FabiShieldState;
  onUpdateShieldState: (updates: Partial<FabiShieldState>, siteUrl?: string) => void;
  onResetSiteOverride?: (siteUrl: string) => void;
  onNavigate?: (url: string) => void;
}

const FABI_EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];

export const BraveStyleShieldEmblem: React.FC<{ active?: boolean; className?: string }> = ({
  active = true,
  className = 'w-5 h-5'
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="fabiBraveShieldGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={active ? '#FA7250' : '#6b7280'} />
        <stop offset="100%" stopColor={active ? '#FB542B' : '#4b5563'} />
      </linearGradient>
    </defs>
    {/* Angular Brave-inspired outer shield */}
    <path
      fill="url(#fabiBraveShieldGrad)"
      d="M12 1.75L3.6 4.9v6.25c0 5.38 3.58 10.16 8.4 11.35 4.82-1.19 8.4-5.97 8.4-11.35V4.9L12 1.75z"
    />
    {/* Crisp faceted inner crest */}
    <path
      fill="#ffffff"
      fillOpacity="0.94"
      d="M12 4.9L6.8 7.15l1.35 2.55 1.1-.45L8.7 13.1 12 16.95l3.3-3.85-.55-3.85 1.1.45 1.35-2.55L12 4.9zm0 2.15l2.7 1.18-.42 1.15-2.28-.68-2.28.68-.42-1.15L12 7.05zm-1.65 3.65L12 10.2l1.65.5-.38 2.1-1.27 1.52-1.27-1.52-.38-2.1z"
    />
  </svg>
);

export const FabiShieldModal: React.FC<FabiShieldModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  language = 'es',
  blockedTrackerUrls = [],
  shieldState,
  onUpdateShieldState,
  onResetSiteOverride,
  onNavigate
}) => {
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [viewMode, setViewMode] = useState<'main' | 'trackers'>('main');
  const [tlsSummary, setTlsSummary] = useState<TlsInspectionResult | null>(null);
  const [faviconError, setFaviconError] = useState(false);

  const { domain: rawDomain, isExternal, hasSiteOverride, effective } = resolveEffectiveShield(
    shieldState,
    currentUrl
  );

  const domain = isExternal
    ? rawDomain
    : currentUrl.startsWith('fabinav://')
    ? 'FabiNav'
    : t(language, 'newTab');

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
  const isForgetEnabled = isExternal && forgetList.includes(rawDomain);

  const handleSiteUpdate = (updates: Partial<FabiShieldState>) => {
    onUpdateShieldState(updates, isExternal ? currentUrl : undefined);
  };

  const handleToggleForgetSite = (nextVal: boolean) => {
    if (!isExternal || !rawDomain) return;
    const nextList = nextVal
      ? Array.from(new Set([...forgetList, rawDomain]))
      : forgetList.filter((d) => d !== rawDomain);
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
          className="fixed top-20 right-4 sm:right-16 w-[372px] bg-[var(--bn-surface)] border border-[var(--bn-border-strong)] shadow-2xl z-50 text-[var(--bn-text)] select-none text-xs rounded-2xl overflow-hidden origin-top-right"
        >
          <AnimatePresence mode="wait" initial={false}>
            {viewMode === 'trackers' ? (
              <motion.div
                key="trackers-detail"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.15, ease: FABI_EASE_OUT }}
                className="flex flex-col max-h-[480px]"
              >
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
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--bn-accent)] shrink-0" />
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
                {/* Brave-style Branded Top Strip */}
                <div className="px-4 py-2.5 bg-[var(--bn-toolbar)] border-b border-[var(--bn-border)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BraveStyleShieldEmblem active={effective.enabled} className="w-4 h-4 shrink-0" />
                    <span className="text-[12px] font-semibold text-[var(--bn-text-strong)] tracking-tight">
                      {t(language, 'shieldsPanelTitle')} · FabiNav
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--bn-text-muted)] shrink-0">
                    <span>
                      {isExternal
                        ? hasSiteOverride
                          ? t(language, 'shieldsSiteCustomized')
                          : t(language, 'shieldsUsingGlobal')
                        : 'FabiNav'}
                    </span>
                    {isExternal && hasSiteOverride && onResetSiteOverride && (
                      <button
                        type="button"
                        onClick={() => onResetSiteOverride(currentUrl)}
                        title={t(language, 'shieldsResetSiteBtn')}
                        aria-label={t(language, 'shieldsResetSiteBtn')}
                        className="p-1 rounded-md hover:bg-[var(--bn-hover)] text-[var(--bn-accent)] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Top Site Header + Master Site Switch */}
                <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] flex items-center justify-center shrink-0 overflow-hidden">
                      {isExternal && !faviconError ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() => setFaviconError(true)}
                          className="w-5 h-5 object-contain"
                        />
                      ) : isExternal ? (
                        <Globe className="w-4 h-4 text-[var(--bn-text-strong)]" />
                      ) : (
                        <BraveStyleShieldEmblem active={effective.enabled} className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-semibold text-[var(--bn-text-strong)] truncate">
                        {domain}
                      </h4>
                      <p className="text-[12px] text-[var(--bn-text-muted)] leading-snug">
                        {t(language, 'shieldsStatusPrefix')}{' '}
                        <strong
                          className={`font-semibold ${
                            effective.enabled
                              ? 'text-[var(--bn-accent)]'
                              : 'text-[var(--bn-text-muted)]'
                          }`}
                        >
                          {effective.enabled
                            ? t(language, 'shieldsEnabledForSite')
                            : t(language, 'shieldsDisabledForSite')}
                        </strong>{' '}
                        {t(language, 'shieldsStatusSuffix')}
                      </p>
                    </div>
                  </div>

                  <FabiSwitch
                    size="md"
                    checked={effective.enabled}
                    onChange={(v) => handleSiteUpdate({ enabled: v })}
                    ariaLabel="Shields switch"
                  />
                </div>

                {/* Brave Blocked Counter Card OR Shields DOWN Notice */}
                <div className="px-4 pb-3.5">
                  {effective.enabled ? (
                    <div className="rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-2xl font-bold text-[var(--bn-accent)] tabular-nums shrink-0 leading-none">
                          {displayBlockedCount}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] text-[var(--bn-text-strong)] font-medium leading-snug">
                            {t(language, 'shieldsBlockedSummary')}
                          </p>
                          <p className="text-[11px] text-[var(--bn-text-muted)] mt-1 tabular-nums truncate">
                            {isExternal
                              ? t(language, 'shieldsLivePageNote')
                              : t(language, 'trackersInternalNote')}
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
                      {isExternal && (
                        <button
                          type="button"
                          onClick={() => setViewMode('trackers')}
                          title={t(language, 'viewBlockedTrackersTooltip')}
                          aria-label={t(language, 'viewBlockedTrackersTooltip')}
                          className="w-7 h-7 rounded-lg hover:bg-[var(--bn-hover)] flex items-center justify-center text-[var(--bn-text-muted)] hover:text-[var(--bn-text-strong)] transition-colors shrink-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] p-4 text-center space-y-2.5">
                      <div className="w-9 h-9 rounded-full bg-[var(--bn-hover)] mx-auto flex items-center justify-center text-[var(--bn-text-muted)]">
                        <ShieldOff className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[13px] font-semibold text-[var(--bn-text-strong)]">
                          {t(language, 'shieldsDownTitle')}
                        </p>
                        <p className="text-[11px] text-[var(--bn-text-muted)] leading-relaxed">
                          {t(language, 'shieldsDownDesc')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSiteUpdate({ enabled: true })}
                        className="px-4 py-1.5 rounded-full bg-[var(--bn-accent)] hover:bg-[var(--bn-accent-hover)] text-white text-[12px] font-medium transition-colors"
                      >
                        {t(language, 'shieldsTurnOnSite')}
                      </button>
                    </div>
                  )}
                </div>

                {effective.enabled && (
                  <>
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
                            {/* Trackers & Ads */}
                            <div className="flex items-center gap-2">
                              <Hand className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                              <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-2.5 py-1.5">
                                <select
                                  value={effective.blockTrackersAndAds}
                                  onChange={(e) =>
                                    handleSiteUpdate({
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

                            {/* HTTPS Upgrade */}
                            <div className="flex items-center gap-2.5">
                              <Lock className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                              <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                                <span className="text-[12px] text-[var(--bn-text-strong)]">
                                  {t(language, 'upgradeToHttps')}
                                </span>
                                <FabiSwitch
                                  checked={effective.upgradeHttps}
                                  onChange={(v) => handleSiteUpdate({ upgradeHttps: v })}
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
                                checked={effective.strictTls}
                                onChange={(v) => handleSiteUpdate({ strictTls: v })}
                                ariaLabel={t(language, 'strictTlsCheck')}
                              />
                            </div>

                            {/* Block Scripts */}
                            <div className="flex items-center justify-between gap-2.5 py-1 px-0.5">
                              <span className="flex items-center gap-2.5 text-[12px] text-[var(--bn-text)]">
                                <Code2 className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                                <span>{t(language, 'blockScripts')}</span>
                              </span>
                              <FabiSwitch
                                checked={effective.blockScripts}
                                onChange={(v) => handleSiteUpdate({ blockScripts: v })}
                                ariaLabel={t(language, 'blockScripts')}
                              />
                            </div>

                            {/* Fingerprinting */}
                            <div className="flex items-center gap-2.5">
                              <Fingerprint className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                              <div className="flex-1 flex items-center bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                                <select
                                  value={effective.blockFingerprinting}
                                  onChange={(e) =>
                                    handleSiteUpdate({
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

                            {/* Third-party Cookies */}
                            <div className="flex items-center gap-2.5">
                              <Cookie className="w-4 h-4 text-[var(--bn-text-muted)] shrink-0" />
                              <div className="flex-1 flex items-center justify-between bg-[var(--bn-surface-alt)] border border-[var(--bn-border-strong)] rounded-xl px-3 py-1.5">
                                <span className="text-[12px] text-[var(--bn-text-strong)]">
                                  {t(language, 'blockThirdPartyCookies')}
                                </span>
                                <FabiSwitch
                                  checked={effective.blockCrossSiteCookies}
                                  onChange={(v) =>
                                    handleSiteUpdate({ blockCrossSiteCookies: v })
                                  }
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
                  </>
                )}

                <div className="h-[1px] bg-[var(--bn-border)]" />

                {/* Footer Actions */}
                <div className="p-4 space-y-2.5 bg-[var(--bn-surface)]">
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

                  {isExternal && hasSiteOverride && onResetSiteOverride && (
                    <button
                      type="button"
                      onClick={() => onResetSiteOverride(currentUrl)}
                      className="w-full py-1.5 rounded-full text-[11px] text-[var(--bn-accent)] hover:bg-[var(--bn-accent-soft)] font-medium transition-colors"
                    >
                      {t(language, 'shieldsResetSiteBtn')}
                    </button>
                  )}

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
