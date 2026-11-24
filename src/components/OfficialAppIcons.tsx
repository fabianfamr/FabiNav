import React from 'react';

interface IconProps {
  className?: string;
}

export const NineDotsIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <circle cx="6" cy="6" r="1.75" />
    <circle cx="12" cy="6" r="1.75" />
    <circle cx="18" cy="6" r="1.75" />
    <circle cx="6" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="18" cy="12" r="1.75" />
    <circle cx="6" cy="18" r="1.75" />
    <circle cx="12" cy="18" r="1.75" />
    <circle cx="18" cy="18" r="1.75" />
  </svg>
);

export const GoogleGIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const GoogleAccountIcon: React.FC<IconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="#3C4043" />
    <circle cx="24" cy="18" r="7" fill="#BDC1C6" />
    <path
      d="M11 38c2.6-6.2 7.6-9.5 13-9.5s10.4 3.3 13 9.5a20.9 20.9 0 0 1-26 0z"
      fill="#9AA0A6"
    />
  </svg>
);

export const GoogleDriveIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#1E88E5" d="M7.6 39.2l4.8 4.8h23.2l4.8-4.8-16.4-9z" />
    <path fill="#FFC107" d="M30 6H18l14.4 25H44z" />
    <path fill="#00AC47" d="M18 6L4 30.2l4.8 9L23.2 14z" />
    <path fill="#0066DA" d="M32.4 31H15.6l-8 8.2h27.6l5.2-8.2z" opacity="0.25" />
    <path fill="#2684FC" d="M12.4 44h23.2l5-8.6H7.4z" />
  </svg>
);

export const GmailIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M6 39V17.4l9.6 7.2V39H8.8A2.8 2.8 0 0 1 6 39z" />
    <path fill="#34A853" d="M42 39V17.4l-9.6 7.2V39h6.8a2.8 2.8 0 0 0 2.8 0z" />
    <path fill="#FBBC05" d="M32.4 24.6V11.8L42 19v6.2l-9.6 7.2z" />
    <path fill="#EA4335" d="M15.6 24.6V11.8L24 18.2l8.4-6.4v12.8L24 31z" />
    <path fill="#C5221F" d="M6 19v-5.2a3.8 3.8 0 0 1 6.1-3l3.5 2.6v11.2L6 17.4z" />
    <path fill="#FBBC05" d="M42 13.8V19l-9.6 5.6V13.4l3.5-2.6a3.8 3.8 0 0 1 6.1 3z" />
    <path fill="#4285F4" d="M6 18.2V37a3 3 0 0 0 3 3h6.6V25.2z" />
    <path fill="#34A853" d="M42 18.2V37a3 3 0 0 1-3 3h-6.6V25.2z" />
  </svg>
);

export const GoogleMapsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#1A73E8"
      d="M28.3 5.7A13.8 13.8 0 0 0 13.2 8.9l6.7 5.6a5.4 5.4 0 0 1 8.4-.1z"
    />
    <path
      fill="#EA4335"
      d="M13.2 8.9A13.8 13.8 0 0 0 10.2 18c0 3.2.8 5.8 2 8.1l7.7-9.1z"
    />
    <path
      fill="#FBBC04"
      d="M12.2 26.1c1.7 3.2 4.3 6.2 6.7 9.6l9.6-11.4a5.4 5.4 0 0 1-8.6 1.2z"
    />
    <path
      fill="#34A853"
      d="M18.9 35.7c2.4 3.4 4.1 6.5 5.1 9.3 1.4-4 4.2-8.2 7.8-12.9a15.3 15.3 0 0 0 4-9.8l-16.9 13.4z"
    />
    <path
      fill="#4285F4"
      d="M28.3 5.7l-8.4 8.7a5.4 5.4 0 0 1 8.6 6.8l7.3-8.7a13.8 13.8 0 0 0-7.5-6.8z"
    />
    <circle cx="24" cy="18" r="5" fill="#FFFFFF" />
  </svg>
);

export const GoogleCalendarIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="6" y="6" width="36" height="36" rx="6" fill="#FFFFFF" />
    <path fill="#1967D2" d="M6 12a6 6 0 0 1 6-6h24v8H6z" />
    <path fill="#4285F4" d="M14 14h20v20H14z" opacity="0.08" />
    <path fill="#FBBC04" d="M36 6h6v10h-6z" />
    <path fill="#34A853" d="M14 36h20v6H14z" />
    <path fill="#EA4335" d="M34 36h8l-8 6z" />
    <path fill="#188038" d="M6 14h8v22H6z" />
    <path fill="#1A73E8" d="M34 14h8v22h-8z" />
    <text
      x="24"
      y="30.5"
      textAnchor="middle"
      fontSize="15"
      fontWeight="700"
      fontFamily="Arial, sans-serif"
      fill="#1A73E8"
    >
      31
    </text>
  </svg>
);

export const GoogleNewsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="8" y="6" width="32" height="12" rx="3" fill="#0F9D58" />
    <rect x="4" y="11" width="40" height="14" rx="3" fill="#EA4335" />
    <rect x="24" y="11" width="20" height="14" rx="3" fill="#FBBC05" />
    <rect x="6" y="16" width="36" height="26" rx="4" fill="#4285F4" />
    <path
      fill="#FFFFFF"
      d="M17.5 29v2.2h4c-.3 1.4-1.6 2.5-4 2.5-2.4 0-4.4-2-4.4-4.5s2-4.5 4.4-4.5c1.4 0 2.3.6 2.8 1.1l1.9-1.8C21 22.8 19.4 22 17.5 22c-3.9 0-7 3.1-7 7s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5-.1-.9-.1-1.2h-6.6z"
    />
    <rect x="27" y="25" width="9" height="2" rx="1" fill="#D2E3FC" />
    <rect x="27" y="29" width="9" height="2" rx="1" fill="#D2E3FC" />
    <rect x="27" y="33" width="6" height="2" rx="1" fill="#D2E3FC" />
  </svg>
);

export const GooglePhotosIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FBBC05" d="M24 24H13a11 11 0 0 1 11-11v11z" />
    <path fill="#EA4335" d="M24 24V13a11 11 0 0 1 11 11H24z" />
    <path fill="#4285F4" d="M24 24h11a11 11 0 0 1-11 11V24z" />
    <path fill="#34A853" d="M24 24v11a11 11 0 0 1-11-11h11z" />
    <path fill="#F57C00" d="M13 24H4a9 9 0 0 1 9-9v9z" opacity="0.9" />
    <path fill="#C5221F" d="M24 13V4a9 9 0 0 1 9 9h-9z" opacity="0.9" />
    <path fill="#1967D2" d="M35 24h9a9 9 0 0 1-9 9v-9z" opacity="0.9" />
    <path fill="#188038" d="M24 35v9a9 9 0 0 1-9-9h9z" opacity="0.9" />
  </svg>
);

export const GoogleTranslateIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="18" y="14" width="24" height="26" rx="3" fill="#DADCE0" />
    <path fill="#5F6368" d="M29.5 21h2v2.2h5.2v2h-1.6a10.2 10.2 0 0 1-2.5 4.8l3.5 3.4-1.4 1.4-3.5-3.4-3.4 3.4-1.4-1.4 3.4-3.4a9.6 9.6 0 0 1-2-3.2h2.2c.4.8.9 1.4 1.3 1.9.7-.8 1.2-1.9 1.5-3.5h-5.8v-2h4.7V21z" />
    <path fill="#4285F4" d="M6 10a3 3 0 0 1 3-3h18l6 27H9a3 3 0 0 1-3-3z" />
    <path
      fill="#FFFFFF"
      d="M17.2 19.5v2.2h3.5c-.3 1.3-1.5 2.2-3.5 2.2-2.1 0-3.8-1.7-3.8-3.9s1.7-3.9 3.8-3.9c1.1 0 1.9.4 2.4.9l1.6-1.6c-1-1-2.4-1.5-4-1.5-3.4 0-6.1 2.7-6.1 6.1s2.7 6.1 6.1 6.1c3.5 0 5.9-2.5 5.9-5.9 0-.4 0-.7-.1-1h-5.8z"
    />
  </svg>
);

export const GoogleMeetIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#00832D" d="M27 24l6 5.5 7 5.5V13l-7 5.5z" />
    <path fill="#0066DA" d="M6 31.5V37a3 3 0 0 0 3 3h7v-8.5H6z" />
    <path fill="#E94235" d="M16 8H9a3 3 0 0 0-3 3v5.5h10V8z" />
    <path fill="#FFBA00" d="M6 16.5h10v15H6z" />
    <path fill="#00AC47" d="M16 8h11a3 3 0 0 1 3 3v13l-3 5.5v10.5H16V8z" />
    <path fill="#2684FC" d="M16 31.5h11V40H16z" />
    <path fill="#00AC47" d="M30 19l10-8v26l-10-8z" />
  </svg>
);

export const GoogleDocsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M12 6h16l10 10v26a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
    <path fill="#1967D2" d="M28 6v10h10z" />
    <rect x="15" y="22" width="18" height="2.6" rx="1.3" fill="#FFFFFF" />
    <rect x="15" y="27.5" width="18" height="2.6" rx="1.3" fill="#FFFFFF" />
    <rect x="15" y="33" width="12" height="2.6" rx="1.3" fill="#FFFFFF" />
  </svg>
);

export const GoogleSheetsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#0F9D58" d="M12 6h16l10 10v26a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
    <path fill="#0B8043" d="M28 6v10h10z" />
    <rect x="14.5" y="22" width="19" height="14" rx="1.5" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
    <line x1="14.5" y1="29" x2="33.5" y2="29" stroke="#FFFFFF" strokeWidth="2.2" />
    <line x1="23" y1="22" x2="23" y2="36" stroke="#FFFFFF" strokeWidth="2.2" />
  </svg>
);

export const GoogleSlidesIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#F4B400" d="M12 6h16l10 10v26a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
    <path fill="#F09300" d="M28 6v10h10z" />
    <rect x="14.5" y="22" width="19" height="13" rx="1.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
    <rect x="18" y="25.5" width="12" height="6" rx="1" fill="#FFFFFF" opacity="0.85" />
  </svg>
);

export const YouTubeIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#FF0000"
      d="M43.2 15.1a5 5 0 0 0-3.5-3.5C36.6 10.7 24 10.7 24 10.7s-12.6 0-15.7.9a5 5 0 0 0-3.5 3.5C4 18.2 4 24 4 24s0 5.8.8 8.9a5 5 0 0 0 3.5 3.5c3.1.9 15.7.9 15.7.9s12.6 0 15.7-.9a5 5 0 0 0 3.5-3.5c.8-3.1.8-8.9.8-8.9s0-5.8-.8-8.9z"
    />
    <path fill="#FFFFFF" d="M20 29.7V18.3l10.4 5.7z" />
  </svg>
);

export const GoogleKeepIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FBBC04" d="M12 6h16l10 10v26a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
    <path fill="#F29900" d="M28 6v10h10z" />
    <path
      fill="#FFFFFF"
      d="M24 20a6 6 0 0 0-3.6 10.8V33a1.5 1.5 0 0 0 1.5 1.5h4.2A1.5 1.5 0 0 0 27.6 33v-2.2A6 6 0 0 0 24 20zm-2.5 16h5a1 1 0 0 1 0 2h-5a1 1 0 0 1 0-2z"
    />
  </svg>
);

export const GooglePlayIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M9 6.6a2.4 2.4 0 0 0-1 2v30.8a2.4 2.4 0 0 0 1 2l.2.1L26.5 24.1v-.2L9.2 6.5z" />
    <path fill="#FBBC05" d="M32.2 29.8L26.5 24v-.2l5.7-5.7.2.1 6.8 3.9c1.9 1.1 1.9 2.9 0 4l-6.8 3.9z" />
    <path fill="#EA4335" d="M32.4 29.7L26.5 24 9 41.4c.6.7 1.7.8 2.9.1l20.5-11.8z" />
    <path fill="#34A853" d="M32.4 18.3L11.9 6.5C10.7 5.8 9.6 5.9 9 6.6L26.5 24z" />
  </svg>
);

export const GoogleShoppingIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.2 7.2L8.7 21.7a3 3 0 0 0 0 4.2l13.4 13.4a3 3 0 0 0 4.2 0l14.5-14.5V10.2a3 3 0 0 0-3-3z"
    />
    <path fill="#34A853" d="M23.2 7.2L15 15.4l15 15 10.8-5.6V10.2a3 3 0 0 0-3-3z" opacity="0.9" />
    <path fill="#FBBC05" d="M8.7 21.7a3 3 0 0 0 0 4.2l8.5 8.5 11.2-11.2-11.2-9.8z" />
    <path fill="#EA4335" d="M26.3 39.3l14.5-14.5v-8.6L20 35z" opacity="0.85" />
    <circle cx="33.5" cy="14.5" r="2.6" fill="#FFFFFF" />
    <path
      fill="#FFFFFF"
      d="M23.5 24.2v2h3.1c-.2 1.1-1.3 1.9-3.1 1.9-1.9 0-3.4-1.5-3.4-3.5s1.5-3.5 3.4-3.5c1 0 1.7.4 2.1.8l1.5-1.4c-.9-.9-2.1-1.4-3.6-1.4-3 0-5.4 2.4-5.4 5.5s2.4 5.5 5.4 5.5c3.1 0 5.2-2.2 5.2-5.3 0-.4 0-.7-.1-.9h-5.1z"
    />
  </svg>
);

export const GoogleEarthIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="19" fill="#1A73E8" />
    <path
      fill="#8AB4F8"
      d="M8.8 12.6C14 14.8 25.4 13.8 36 8.2a19 19 0 0 0-27.2 4.4z"
    />
    <path
      fill="#AECBFA"
      d="M5.4 20.5c9.8 4.4 25.4 2.8 36.8-4.1a19 19 0 0 0-3.1-5C28 17.5 14 18.6 6.8 15.8a19.2 19.2 0 0 0-1.4 4.7z"
    />
    <path
      fill="#669DF6"
      d="M5.6 29.2c10.4 4 24.4 2 36.8-5.7 0-.8-.2-1.7-.4-2.5C29.4 28.4 14.8 30 5.1 26.1c.1 1.1.3 2.1.5 3.1z"
    />
    <path
      fill="#4285F4"
      d="M11.6 38.4c8.8 2 18.8-.3 28.2-6.3a19 19 0 0 1-28.2 6.3z"
    />
  </svg>
);

export const GoogleContactsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="19" fill="#1A73E8" />
    <circle cx="24" cy="18" r="6.2" fill="#AECBFA" />
    <path
      fill="#D2E3FC"
      d="M12.5 35.5c2.2-5 6.6-7.8 11.5-7.8s9.3 2.8 11.5 7.8a16.8 16.8 0 0 1-23 0z"
    />
  </svg>
);

export const WikipediaIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="19" fill="#F1F3F4" />
    <path
      fill="#202124"
      d="M11.5 16h5.3v1.1c-.9.1-1.3.4-.9 1.3l4.2 9.9 2.3-5.2-2.1-4.7c-.4-.9-.9-1.2-1.8-1.3V16h5.1v1.1c-.8.1-1.2.4-.8 1.2l1.4 3.2 1.5-3.2c.4-.9.1-1.1-.8-1.2V16h4.5v1.1c-1 .1-1.5.5-2 1.5l-2.3 4.8 2.8 6.4 4.1-9.7c.4-.9.1-1.3-1-1.4V16h4.9v1.1c-1 .1-1.6.6-2.1 1.8l-6.1 14.3h-1.2l-3.2-7.1-3.3 7.1h-1.2L13.6 18.8c-.5-1.1-1-1.6-2.1-1.7V16z"
    />
  </svg>
);

export const GitHubIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="19" fill="#24292F" />
    <path
      fill="#FFFFFF"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M24 10.5c-7.5 0-13.5 6-13.5 13.5 0 6 3.9 11 9.2 12.8.7.1.9-.3.9-.7v-2.4c-3.8.8-4.5-1.8-4.5-1.8-.6-1.6-1.5-2-1.5-2-1.2-.8.1-.8.1-.8 1.4.1 2.1 1.4 2.1 1.4 1.2 2.1 3.2 1.5 4 1.1.1-.9.5-1.5.9-1.8-3-.3-6.1-1.5-6.1-6.7 0-1.5.5-2.7 1.4-3.6-.1-.3-.6-1.7.1-3.5 0 0 1.1-.4 3.7 1.4 1.1-.3 2.2-.5 3.4-.5s2.3.2 3.4.5c2.6-1.8 3.7-1.4 3.7-1.4.7 1.8.3 3.2.1 3.5.9.9 1.4 2.1 1.4 3.6 0 5.2-3.2 6.4-6.2 6.7.5.4.9 1.2.9 2.5v3.7c0 .4.2.8.9.7 5.4-1.8 9.2-6.9 9.2-12.8 0-7.5-6-13.5-13.5-13.5z"
    />
  </svg>
);

export const ArchiveOrgIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="6" y="6" width="36" height="36" rx="8" fill="#2B2D30" />
    <path fill="#E8EAED" d="M24 11l12 5v2H12v-2zM14 20h3v13h-3zm6 0h3v13h-3zm5 0h3v13h-3zm6 0h3v13h-3zM11 35h26v2.5H11z" />
  </svg>
);
