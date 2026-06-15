/**
 * PostHog stub - analytics disabled in WRead self-hosted
 */

const posthogStub = {
  init: () => {},
  identify: () => {},
  capture: () => {},
  reset: () => {},
  get_distinct_id: () => '',
  isFeatureEnabled: () => false,
  onFeatureFlags: () => {},
  shutdown: () => {},
  debug: () => {},
};

export default posthogStub;
