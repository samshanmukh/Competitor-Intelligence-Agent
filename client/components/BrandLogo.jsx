import Link from 'next/link';

/**
 * Mira text wordmark for app chrome. No image logo.
 */
export default function BrandLogo({
  href = '/',
  className = '',
  height = 28,
  variant = 'full',
}) {
  const sizeClass =
    height >= 40 ? 'text-2xl' : height >= 32 ? 'text-xl' : height >= 26 ? 'text-base' : height <= 18 ? 'text-xs' : 'text-sm';

  const mark = (
    <span
      style={{ fontFamily: 'var(--font-brand)' }}
      className={`font-semibold leading-none tracking-tight text-white ${sizeClass} ${className}`}
    >
      {variant === 'mark' ? 'M' : 'Mira'}
    </span>
  );

  if (href === null || href === false) return mark;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Mira home">
      {mark}
    </Link>
  );
}
