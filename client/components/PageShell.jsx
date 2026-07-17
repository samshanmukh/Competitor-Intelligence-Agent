export function PageShell({ children, className = '', width = 'max-w-3xl' }) {
  return (
    <div className={`mx-auto w-full ${width} space-y-6 pb-20 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
