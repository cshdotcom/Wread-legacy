'use client';

/**
 * WRead PHContext Stub
 * PostHog analytics is disabled in self-hosted WRead.
 * Provides a no-op provider that doesn't import posthog-js.
 */

import { ReactNode } from 'react';

// No-op provider — children are rendered as-is
export const CSPostHogProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};
