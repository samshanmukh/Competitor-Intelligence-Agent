import BrandLogo from '../../components/BrandLogo';

export default function AuthLayout({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo href="/" height={40} priority />
          </div>
          <p className="text-sm text-slate-500">Competitive and market intelligence for founders</p>
        </div>
        {children}
      </div>
    </div>
  );
}
