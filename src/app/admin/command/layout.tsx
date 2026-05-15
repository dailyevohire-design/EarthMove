import { headers } from 'next/headers';
import Link from 'next/link';

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';

  const tabs: { href: string; label: string; activePrefix: string }[] = [
    { href: '/admin/command', label: 'Queue', activePrefix: '/admin/command' },
    { href: '/admin/command/live', label: 'Live', activePrefix: '/admin/command/live' },
    { href: '/admin/command/funnels', label: 'Funnels', activePrefix: '/admin/command/funnels' },
  ];

  // Queue is the index — only "active" when path is exactly /admin/command, not nested.
  function isActive(tab: { href: string; activePrefix: string }): boolean {
    if (tab.href === '/admin/command') return pathname === '/admin/command' || pathname === '/admin/command/';
    return pathname.startsWith(tab.activePrefix);
  }

  return (
    <>
      <nav className="border-b border-stone-200 bg-white">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-1">
          {tabs.map((t) => {
            const active = isActive(t);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
