/**
 * PostHog stub - analytics disabled in WRead self-hosted
 */

const posthogStub = {
  init: () => {},
  identify: () => {},
  capture: (_event?: string, _properties?: Record<string, unknown>) => {},
  captureException: (_err: unknown) => {},
  reset: () => {},
  get_distinct_id: () => '',
  isFeatureEnabled: () => false,
  onFeatureFlags: () => {},
  shutdown: () => {},
  debug: () => {},
  register_for_session: () => {},
  opt_in_capturing: () => {},
  opt_out_capturing: () => {},
  has_opted_out_capturing: () => true,
};

export default posthogStub;
