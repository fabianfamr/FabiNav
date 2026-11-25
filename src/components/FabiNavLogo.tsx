import React from 'react';

interface FabiNavLogoProps {
  className?: string;
  alt?: string;
  monochrome?: boolean;
}

export const FabiNavLogo: React.FC<FabiNavLogoProps> = ({
  className = 'w-10 h-10',
  alt = 'Logo de FabiNav',
  monochrome = false
}) => {
  const gradOrbitId = React.useId();
  const gradRibbonId = React.useId();
  const gradHaloId = React.useId();

  // Strip box-background/box-shadow utility classes so the transparent emblem never renders a square frame
  const cleanClassName = className
    .split(/\s+/)
    .filter((token) => token && !/^(rounded|shadow|bg-|ring|border)/.test(token))
    .join(' ');

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
      className={`shrink-0 select-none overflow-visible ${
        monochrome ? '' : 'drop-shadow-[0_2px_8px_rgba(251,84,43,0.22)]'
      } ${cleanClassName}`}
    >
      {!monochrome && (
        <defs>
          <linearGradient id={gradOrbitId} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fa7250" />
            <stop offset="55%" stopColor="#fb542b" />
            <stop offset="100%" stopColor="#ff1893" />
          </linearGradient>
          <linearGradient id={gradRibbonId} x1="20" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff8a65" />
            <stop offset="50%" stopColor="#fb542b" />
            <stop offset="100%" stopColor="#ff1893" />
          </linearGradient>
          <linearGradient id={gradHaloId} x1="8" y1="42" x2="56" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff9a7a" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#ff5cb3" stopOpacity="0.88" />
          </linearGradient>
        </defs>
      )}

      {/* Open orbital navigation ring */}
      <circle
        cx="32"
        cy="32"
        r="22"
        stroke={monochrome ? 'currentColor' : `url(#${gradOrbitId})`}
        strokeWidth="4.6"
        strokeDasharray="106 32"
        strokeDashoffset="10"
        strokeLinecap="round"
        opacity={monochrome ? 0.9 : 1}
      />

      {/* Back portion of tilted orbital halo */}
      <path
        d="M9.5 26.8C16.2 19.6 38.8 16.5 53.5 23.2"
        stroke={monochrome ? 'currentColor' : `url(#${gradHaloId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity={monochrome ? 0.45 : 0.72}
      />

      {/* Aerodynamic slanted 'F' monogram */}
      <path
        d="M21.2 49.4L27.4 18.8C27.9 16.3 29.8 14.8 32.4 14.8H48.6L44.6 21.4H33.6L31.9 29.3H42.6L38.9 35.6H30.5L27.5 49.4H21.2Z"
        fill={monochrome ? 'currentColor' : `url(#${gradRibbonId})`}
      />

      {/* Crisp upper bevel highlights */}
      {!monochrome && (
        <>
          <path
            d="M35.2 14.8H48.6L44.6 21.4H37.8L35.2 14.8Z"
            fill="#ffffff"
            fillOpacity="0.28"
          />
          <path
            d="M34.4 29.3H42.6L38.9 35.6H33.4L34.4 29.3Z"
            fill="#ffffff"
            fillOpacity="0.2"
          />
        </>
      )}

      {/* Front swoosh of tilted orbital halo */}
      <path
        d="M10.2 38.6C19.8 47.4 42.4 42.6 54.6 27.2"
        stroke={monochrome ? 'currentColor' : `url(#${gradHaloId})`}
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity={monochrome ? 0.65 : 1}
      />
    </svg>
  );
};

interface FabiNavFaviconMarkProps {
  className?: string;
  monochrome?: boolean;
}

export const FabiNavFaviconMark: React.FC<FabiNavFaviconMarkProps> = ({
  className = 'w-3.5 h-3.5',
  monochrome = false
}) => {
  return <FabiNavLogo className={className} alt="FabiNav" monochrome={monochrome} />;
};
