import Link from 'next/link';
import Image from 'next/image';

/**
 * Mira brand mark. Prefer this over "Mira AI" text in chrome.
 * `full` = wordmark (crescent + Mira). `mark` = square icon.
 */
export default function BrandLogo({
  href = '/',
  className = '',
  height = 28,
  variant = 'full',
  priority = false,
}) {
  const isMark = variant === 'mark';
  const src = isMark ? '/mira-icon.png' : '/mira-logo.png';
  const width = isMark ? height : Math.round((height * 1024) / 682);

  const img = (
    <Image
      src={src}
      alt="Mira"
      width={width}
      height={height}
      priority={priority}
      className={`object-contain ${isMark ? 'rounded-lg' : ''} ${className}`}
      style={{ height, width: isMark ? height : 'auto' }}
    />
  );

  if (href === null || href === false) return img;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Mira home">
      {img}
    </Link>
  );
}
