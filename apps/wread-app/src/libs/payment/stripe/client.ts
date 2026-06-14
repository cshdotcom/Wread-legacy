/**
 * WRead Stripe Payment Stub
 * Stripe payment is disabled in self-hosted WRead.
 * All self-hosted users get the pro plan by default.
 */

import type { AvailablePlan } from '@/types/quota';

export interface StripeAvailablePlan extends AvailablePlan {
  product?: { name: string };
  productName: string;
}

export const fetchStripePlans = async (): Promise<AvailablePlan[]> => {
  // Self-hosted: return a single "Self-Hosted Pro" plan
  return [
    {
      productId: 'self-hosted-pro',
      plan: 'pro' as const,
      productName: 'Self-Hosted Pro',
      price: 0,
      currency: 'usd',
      interval: 'lifetime' as const,
    },
  ];
};

export const createStripeCheckoutSession = async (_productId?: string, _planType?: string) => {
  throw new Error('Stripe checkout is not available in self-hosted mode');
};

export const redirectToStripeCheckout = async (_url?: string) => {
  throw new Error('Stripe checkout is not available in self-hosted mode');
};

export const createStripePortalSession = async (): Promise<string> => {
  throw new Error('Stripe portal is not available in self-hosted mode');
};

export const redirectToStripePortal = async (_url?: string) => {
  throw new Error('Stripe portal is not available in self-hosted mode');
};

export const handleStripeCheckoutError = (_error: string) => {
  console.warn('Stripe is not available in self-hosted mode');
};

export const getSubscriptionSuccessUrl = (_sessionId?: string) => '/user/subscription/success';
