import { ThinkingShimmerDemo } from '../../../components/ThinkingShimmer';

export const metadata = {
  title: 'Thinking shimmer demo',
  robots: { index: false, follow: false },
};

export default function ThinkingShimmerDemoPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16">
      <ThinkingShimmerDemo />
      <p className="mt-4 text-center text-[11px] text-slate-600">
        Dev-only preview — noindex. Live path: Ask Mira stream.
      </p>
    </div>
  );
}
