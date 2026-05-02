'use client';

/**
 * Persists the sidebar collapsed state and exposes it to descendants.
 * Toggled with Ctrl/Cmd+B. Renders a transparent provider — no DOM.
 *
 * The state is reflected via `data-sidebar-collapsed` on the document
 * root so plain CSS in `globals.css` can adjust the grid without prop
 * drilling through the layout tree.
 */

import * as React from 'react';
import { useShortcuts } from '@/lib/hooks/use-keyboard';

const STORAGE_KEY = 'pb.sidebar.collapsed';

export function SidebarCollapseController() {
  // Hydrate from localStorage on mount, then keep the doc attribute in sync.
  React.useEffect(() => {
    const initial = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
    document.documentElement.dataset.sidebarCollapsed = String(initial);
  }, []);

  useShortcuts([
    {
      combo: 'mod+b',
      description: 'Toggle navigation sidebar',
      handler: () => {
        const root = document.documentElement;
        const next = root.dataset.sidebarCollapsed !== 'true';
        root.dataset.sidebarCollapsed = String(next);
        try {
          localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        } catch {
          // Private mode / quota — ignore. Sidebar state is non-critical.
        }
      },
    },
  ]);

  return null;
}
