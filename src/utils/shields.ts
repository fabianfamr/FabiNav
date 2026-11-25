import { FabiShieldState, SiteShieldOverride } from '../types';

export interface EffectiveShieldResult {
  domain: string;
  isExternal: boolean;
  hasSiteOverride: boolean;
  effective: FabiShieldState;
}

export function extractShieldDomain(rawUrl: string): string {
  if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
    return '';
  }
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function resolveEffectiveShield(
  shieldState: FabiShieldState,
  rawUrl: string
): EffectiveShieldResult {
  const domain = extractShieldDomain(rawUrl);
  const isExternal = !!domain;
  const override = isExternal ? shieldState.siteOverrides?.[domain] : undefined;
  const hasSiteOverride = !!(override && Object.keys(override).length > 0);

  if (!override) {
    return {
      domain,
      isExternal,
      hasSiteOverride: false,
      effective: shieldState
    };
  }

  return {
    domain,
    isExternal,
    hasSiteOverride,
    effective: {
      ...shieldState,
      enabled: override.enabled ?? shieldState.enabled,
      blockTrackersAndAds: override.blockTrackersAndAds ?? shieldState.blockTrackersAndAds,
      upgradeHttps: override.upgradeHttps ?? shieldState.upgradeHttps,
      strictTls: override.strictTls ?? shieldState.strictTls,
      blockScripts: override.blockScripts ?? shieldState.blockScripts,
      blockFingerprinting: override.blockFingerprinting ?? shieldState.blockFingerprinting,
      blockCrossSiteCookies: override.blockCrossSiteCookies ?? shieldState.blockCrossSiteCookies
    }
  };
}

export function applySiteShieldUpdate(
  prev: FabiShieldState,
  rawUrl: string,
  updates: Partial<FabiShieldState>
): FabiShieldState {
  const domain = extractShieldDomain(rawUrl);
  const siteScopedKeys: Array<keyof SiteShieldOverride> = [
    'enabled',
    'blockTrackersAndAds',
    'upgradeHttps',
    'strictTls',
    'blockScripts',
    'blockFingerprinting',
    'blockCrossSiteCookies'
  ];

  const sitePatch: SiteShieldOverride = {};
  const globalPatch: Partial<FabiShieldState> = {};

  for (const [k, v] of Object.entries(updates)) {
    if (domain && siteScopedKeys.includes(k as keyof SiteShieldOverride)) {
      (sitePatch as Record<string, unknown>)[k] = v;
    } else {
      (globalPatch as Record<string, unknown>)[k] = v;
    }
  }

  const nextOverrides = { ...(prev.siteOverrides || {}) };
  if (domain && Object.keys(sitePatch).length > 0) {
    nextOverrides[domain] = {
      ...(nextOverrides[domain] || {}),
      ...sitePatch
    };
  }

  return {
    ...prev,
    ...globalPatch,
    siteOverrides: nextOverrides
  };
}

export function resetSiteShieldOverride(
  prev: FabiShieldState,
  rawUrlOrDomain: string
): FabiShieldState {
  const domain = rawUrlOrDomain.includes('://')
    ? extractShieldDomain(rawUrlOrDomain)
    : rawUrlOrDomain.replace(/^www\./, '').toLowerCase();
  if (!domain || !prev.siteOverrides?.[domain]) return prev;
  const nextOverrides = { ...prev.siteOverrides };
  delete nextOverrides[domain];
  return {
    ...prev,
    siteOverrides: nextOverrides
  };
}
