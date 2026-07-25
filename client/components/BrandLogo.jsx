import Link from 'next/link';
import MiraMark from './MiraMark';

/**
 * Mira brand logo — official SVG mark + wordmark.
 * variant="mark" → icon only (collapsed sidebar)
 * variant="full" → icon + "Mira" (dark UI; white wordmark)
 * variant="lockup" → full official SVG lockup (mark + designed wordmark; best on light)
 * wordmarkTone: "light" (default, dark UI) | "brand" (deep purple)
 */
export default function BrandLogo({
  href = '/',
  className = '',
  height = 28,
  variant = 'full',
  wordmarkTone = 'light',
  priority: _priority,
}) {
  if (variant === 'lockup') {
    const width = Math.round(height * (866 / 301));
    const logo = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/mira-logo.svg"
        alt="Mira"
        height={height}
        width={width}
        className={`inline-block object-contain ${className}`}
        style={{ height, width: 'auto' }}
        draggable={false}
        decoding="async"
      />
    );
    if (href === null || href === false) return logo;
    return (
      <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Mira home">
        {logo}
      </Link>
    );
  }

  const iconPx = Math.round(height * (variant === 'mark' ? 1 : 0.95));
  const textClass =
    height >= 40
      ? 'text-[1.65rem]'
      : height >= 32
        ? 'text-xl'
        : height >= 26
          ? 'text-[1.05rem]'
          : height <= 18
            ? 'text-xs'
            : 'text-sm';
  const wordColor = wordmarkTone === 'brand' ? 'text-[#2D1E4E]' : 'text-white';

  const logo = (
    <span className={`inline-flex items-center ${variant === 'mark' ? '' : 'gap-2'} ${className}`}>
      <span className="inline-flex shrink-0" style={{ width: iconPx, height: iconPx }}>
        <MiraMark className="h-full w-full" title={variant === 'mark' ? 'Mira' : undefined} />
      </span>
      {variant !== 'mark' && (
        <span
          style={{ fontFamily: 'var(--font-brand)' }}
          className={`font-bold leading-none tracking-tight ${textClass} ${wordColor}`}
        >
          Mira
        </span>
      )}
    </span>
  );

  if (href === null || href === false) return logo;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Mira home">
      {logo}
    </Link>
  );
}
