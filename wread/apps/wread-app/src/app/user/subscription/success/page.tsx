/**
 * WRead Subscription Success Page Stub
 * No subscription system in WRead - redirect to user page.
 */
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubscriptionSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/user');
  }, [router]);

  return null;
}
