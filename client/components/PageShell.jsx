export function PageShell({ children, className = '', width = 'max-w-3xl' }) {
  return (
    <div className={`mx-auto w-full min-w-0 ${width} space-y-7 pb-24 sm:space-y-8 sm:pb-20 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action, className = '' }) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${className}`.trim()}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
