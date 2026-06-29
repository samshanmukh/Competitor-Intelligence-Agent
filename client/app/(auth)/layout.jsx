export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <circle cx="12" cy="12" r="9"/><path d="M12 12 7 7"/><path d="M12 3a9 9 0 0 1 9 9"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Competitor Intelligence Agent</h1>
          <p className="mt-1 text-sm text-slate-500">Competitive intelligence, automated</p>
        </div>
        {children}
      </div>
    </div>
  );
}
