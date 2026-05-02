'use client';

/**
 * App-level keyboard shortcuts. Mounted once inside the `(app)` layout.
 *
 * Add new bindings here only — don't sprinkle keydown listeners across pages.
 * The hook handles input-field filtering and platform-correct mod keys (mod
 * = Cmd on macOS, Ctrl elsewhere).
 */

import { useRouter } from 'next/navigation';
import { useShortcuts } from '@/lib/hooks/use-keyboard';
import { kickSync } from '@/lib/offline';

export function AppShortcuts() {
  const router = useRouter();

  useShortcuts([
    // Quick-create the four high-traffic ERP entry forms.
    { combo: 'alt+q', handler: () => router.push('/quotations/new'), description: 'New quotation' },
    { combo: 'alt+i', handler: () => router.push('/inquiries/new'),  description: 'New inquiry' },
    { combo: 'alt+s', handler: () => router.push('/sales-orders/new'), description: 'New sales order' },
    { combo: 'alt+c', handler: () => router.push('/customers/new'),    description: 'New customer' },

    // Force a sync drain. Useful when a user wants to confirm everything went up.
    { combo: 'mod+shift+s', handler: () => void kickSync(), description: 'Force sync now' },

    // Common navigation jumps (Tally-style: Alt+letter goes "home" of a module).
    { combo: 'alt+d', handler: () => router.push('/dashboard'), description: 'Dashboard' },

    // Help: F1 (function keys are allowed in inputs).
    { combo: 'f1', handler: () => router.push('/flow-guide'), description: 'Help / Flow guide', allowInInput: true },
  ]);

  return null;
}
