'use client';

import { useId } from 'react';

const WAVE =
  'M6.5 37.2 C13 44 18.2 29.2 25.8 33 C33.5 36.8 37 23.2 45.2 27.8 C51.2 31.4 55.2 37.2 61.5 33.5';

/**
 * Mira brand mark — crescent, pulse wave, and ascending dots.
 * Wave is masked out of the crescent so it reads on any background.
 */
export default function MiraMark({ className = 'h-7 w-7', title }) {
  const uid = useId().replace(/:/g, '');
  const grad = `miraGrad-${uid}`;
  const soft = `miraSoft-${uid}`;
  const cut = `miraCut-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={grad} x1="8" y1="4" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="50%" stopColor="#E8B4E4" />
          <stop offset="100%" stopColor="#F9A8C4" />
        </linearGradient>
        <linearGradient id={soft} x1="6" y1="28" x2="58" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4C4FE" />
          <stop offset="100%" stopColor="#FBCFE8" />
        </linearGradient>
        <mask id={cut} maskUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="#fff" />
          <path
            d={WAVE}
            fill="none"
            stroke="#000"
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      {/* Thick crescent / C opening toward upper-right */}
      <path
        d="M47.2 10.8 A 23 23 0 1 0 50.2 43.2"
        fill="none"
        stroke={`url(#${grad})`}
        strokeWidth="14"
        strokeLinecap="round"
        mask={`url(#${cut})`}
      />

      {/* Pulse wave */}
      <path
        d={WAVE}
        fill="none"
        stroke={`url(#${soft})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ascending dots along the open upper-right arc */}
      <circle cx="41.2" cy="9.2" r="1.15" fill={`url(#${grad})`} />
      <circle cx="45" cy="10.8" r="1.35" fill={`url(#${grad})`} />
      <circle cx="48.4" cy="13.2" r="1.55" fill={`url(#${grad})`} />
      <circle cx="51.2" cy="16.4" r="1.8" fill={`url(#${grad})`} />
      <circle cx="53.4" cy="20.2" r="2.05" fill={`url(#${grad})`} />
      <circle cx="54.8" cy="24.5" r="2.3" fill={`url(#${grad})`} />
      <circle cx="55.5" cy="29.2" r="2.55" fill={`url(#${grad})`} />
    </svg>
  );
}
