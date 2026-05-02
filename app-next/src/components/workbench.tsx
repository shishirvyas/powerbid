'use client';

/**
 * Workbench — the main work-area shell that sits to the right of the
 * navigation tree. Provides three sticky regions:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ toolbar (breadcrumb + actions)  36px    │  sticky top
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │ body (forms, tables, dashboards)        │  scrolls
 *   │                                         │
 *   ├─────────────────────────────────────────┤
 *   │ status bar (sync, online, version) 24px │  sticky bottom
 *   └─────────────────────────────────────────┘
 *
 * Pages just render their content as children. Toolbar slot is optional
 * — most list/form pages will use the default breadcrumb derived from the
 * route, but a page can override it via `<Workbench toolbar={…}>`.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StatusBar } from './status-bar';

interface Crumb {
  label: string;
  href?: string;
}

function defaultCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return [{ label: 'Dashboard' }];
  return parts.map((slug, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/');
    const label = slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, href: i < parts.length - 1 ? href : undefined };
  });
}

export function Workbench({
  children,
  toolbar,
  toolbarRight,
}: {
  children: React.ReactNode;
  /** Override the default breadcrumb. */
  toolbar?: React.ReactNode;
  /** Right-aligned action area in the toolbar (Save, Filter, etc.). */
  toolbarRight?: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = React.useMemo(() => defaultCrumbs(pathname), [pathname]);

  return (
    <div className="workbench dense-ui">
      <div className="wb-toolbar">
        {toolbar ?? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
            {crumbs.map((c, i) => (
              <React.Fragment key={`${c.label}-${i}`}>
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
                {c.href ? (
                  <Link
                    href={c.href}
                    prefetch
                    className="wb-toolbar__title text-muted-foreground hover:text-foreground truncate"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="wb-toolbar__title truncate">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <span className="wb-toolbar__spacer" />
        {toolbarRight}
      </div>

      <div className="wb-body app-route-fade app-scroll-area">{children}</div>

      <StatusBar />
    </div>
  );
}
