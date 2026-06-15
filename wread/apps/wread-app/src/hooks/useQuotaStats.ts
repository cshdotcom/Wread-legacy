import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { QuotaType, UserPlan } from '@/types/quota';
import { getStoragePlanData, getTranslationPlanData, getUserProfilePlan } from '@/utils/access';
import { useTranslation } from './useTranslation';

export const useQuotaStats = (briefName = false) => {
  const _ = useTranslation();
  const { token, user } = useAuth();
  const [quotas, setQuotas] = useState<QuotaType[]>([]);
  const [userProfilePlan, setUserProfilePlan] = useState<UserPlan | undefined>(undefined);

  useEffect(() => {
    if (!user || !token) return;

    const storagPlan = getStoragePlanData(token);
    const storageIsUnlimited = storagPlan.quota === 0;
    const inGB = !storageIsUnlimited && storagPlan.quota > 1e9;
    const storageQuota: QuotaType = {
      name: briefName ? _('Storage') : _('Cloud Sync Storage'),
      tooltip: storageIsUnlimited
        ? _('Unlimited Cloud Sync Space')
        : _('{{percentage}}% of Cloud Sync Space Used.', {
            percentage: Math.round((storagPlan.usage / storagPlan.quota) * 100),
          }),
      used: storageIsUnlimited
        ? parseFloat((storagPlan.usage / 1024 / 1024 / 1024).toFixed(2))
        : parseFloat((storagPlan.usage / 1024 / 1024 / (inGB ? 1024 : 1)).toFixed(2)),
      total: storageIsUnlimited ? 0 : Math.round((storagPlan.quota / 1024 / 1024 / (inGB ? 1024 : 1)) * 10) / 10,
      unit: storageIsUnlimited ? 'GB' : inGB ? 'GB' : 'MB',
    };
    const translationPlan = getTranslationPlanData(token);
    const translationIsUnlimited = translationPlan.quota === 0;
    const now = new Date();
    const translationResetAt = !translationIsUnlimited
      ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      : undefined;
    const translationQuota: QuotaType = {
      name: briefName ? _('Translation') : _('Translation Characters'),
      tooltip: translationIsUnlimited
        ? _('Unlimited Daily Translation Characters')
        : _('{{percentage}}% of Daily Translation Characters Used.', {
            percentage: Math.round((translationPlan.usage / translationPlan.quota) * 100),
          }),
      used: translationIsUnlimited
        ? Math.round(translationPlan.usage / 1024)
        : Math.round(translationPlan.usage / 1024),
      total: translationIsUnlimited ? 0 : Math.round(translationPlan.quota / 1024),
      unit: 'K',
      resetAt: translationResetAt,
    };
    setUserProfilePlan(getUserProfilePlan(token));
    setQuotas([storageQuota, translationQuota]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return {
    quotas,
    userProfilePlan,
  };
};
