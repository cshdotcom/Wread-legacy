/**
 * WRead IAP Payment Stub
 * In-app purchase is disabled in self-hosted WRead.
 */

export const fetchAndTransformIAPPlans = async (_productIds?: string[]) => [];
export const isIAPAvailable = async () => false;
export const purchaseIAPProduct = async (_productId?: string) => null;
export const restoreIAPPurchases = async (): Promise<Record<string, unknown>[]> => [];
export const getSubscriptionSuccessUrl = (_purchase?: unknown) => '/user/subscription/success';
