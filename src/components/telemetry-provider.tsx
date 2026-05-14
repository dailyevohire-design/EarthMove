'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { telemetry } from '@/lib/telemetry';

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Boot once on mount
  useEffect(() => {
    telemetry.boot({
      // Cart + groundcheck getters wire up in commit 2 once we instrument those features.
      // Left as no-ops here so the foundation can ship independently.
    });
    if (pathname) {
      telemetry.emit('page.view', { path: pathname, referrer: document.referrer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change emits page.exit + page.view
  useEffect(() => {
    if (!pathname) return;
    telemetry.onRouteChange(pathname);
  }, [pathname]);

  return <>{children}</>;
}
