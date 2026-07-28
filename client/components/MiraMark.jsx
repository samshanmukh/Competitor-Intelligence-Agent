/**
 * Mira brand mark, official SVG asset (crescent, pulse wave, ascending dots).
 */
export default function MiraMark({ className = 'h-7 w-7', title }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mira-mark.svg?v=3"
      alt={title || ''}
      width={64}
      height={64}
      className={className}
      draggable={false}
      decoding="async"
    />
  );
}
