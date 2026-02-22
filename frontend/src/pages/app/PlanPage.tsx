import { useEffect, useState } from 'react';
import { CreditCard, Check, Minus, Crown, Sparkles, Zap } from 'lucide-react';
import { plansApi } from '../../api/client';
import type { Plan, EntitlementValue } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

function annualPrice(cents: number, discountPct: number): string {
  const monthly = (cents / 100) * (1 - discountPct / 100);
  return `$${monthly.toFixed(2)}`;
}

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState('');
  const [billingWaived, setBillingWaived] = useState(false);
  const [subscriptionCredits, setSubscriptionCredits] = useState(0);
  const [purchasedCredits, setPurchasedCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    plansApi.list()
      .then((data) => {
        setPlans(data.plans);
        setCurrentPlanId(data.currentPlanId);
        setBillingWaived(data.billingWaived);
        setSubscriptionCredits(data.tenantSubscriptionCredits);
        setPurchasedCredits(data.tenantPurchasedCredits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const currentPlan = plans.find(p => p.id === currentPlanId);
  const hasCredits = plans.some(p => p.usageCreditsPerMonth > 0);
  const hasBonusCredits = plans.some(p => p.bonusCredits > 0);
  const hasAnnual = plans.some(p => p.annualDiscountPct > 0);

  // Collect all unique entitlement keys with descriptions
  const entitlementKeys: { key: string; description: string }[] = [];
  const seenKeys = new Set<string>();
  for (const plan of plans) {
    for (const [key, val] of Object.entries(plan.entitlements || {})) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        entitlementKeys.push({ key, description: val.description || key });
      }
    }
  }

  // Sort plans by price for display
  const sortedPlans = [...plans].sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);
  const currentPlanIndex = sortedPlans.findIndex(p => p.id === currentPlanId);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-primary-400" />
          Your Plan
        </h1>
        <p className="text-dark-400 mt-1">
          Manage your subscription and compare available plans
        </p>
      </div>

      {/* Current Plan Banner */}
      {currentPlan && (
        <div className="bg-gradient-to-r from-primary-500/10 via-accent-purple/10 to-primary-500/10 border border-primary-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary-400" />
                <span className="text-sm font-medium text-primary-400">Current Plan</span>
                {billingWaived && (
                  <span className="px-2 py-0.5 bg-accent-emerald/10 text-accent-emerald text-xs font-medium rounded-full">
                    Billing Waived
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white">{currentPlan.name}</h2>
              {currentPlan.description && (
                <p className="text-dark-300 mt-1">{currentPlan.description}</p>
              )}
              {(hasCredits || hasBonusCredits) && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary-400" />
                    <span className="text-sm text-dark-300">
                      <span className="text-white font-semibold">{(subscriptionCredits + purchasedCredits).toLocaleString()}</span>
                      {' '}credits total
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-dark-400 ml-6">
                    <span>{subscriptionCredits.toLocaleString()} from monthly plan</span>
                    <span>{purchasedCredits.toLocaleString()} from purchases &amp; bonuses</span>
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {formatPrice(currentPlan.monthlyPriceCents)}
              </div>
              {currentPlan.monthlyPriceCents > 0 && (
                <span className="text-dark-400 text-sm">/month</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className={`grid gap-6 mb-10 ${
        sortedPlans.length <= 3 ? `grid-cols-1 md:grid-cols-${sortedPlans.length}` : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {sortedPlans.map((plan, idx) => {
          const isCurrent = plan.id === currentPlanId;
          const isUpgrade = idx > currentPlanIndex;
          const isPopular = idx === 1 && sortedPlans.length >= 3;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 transition-all ${
                isCurrent
                  ? 'bg-primary-500/5 border-primary-500/30 ring-1 ring-primary-500/20'
                  : 'bg-dark-900/50 border-dark-800 hover:border-dark-700'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-6 px-3 py-0.5 bg-primary-500 text-white text-xs font-medium rounded-full">
                  Current Plan
                </div>
              )}
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-6 px-3 py-0.5 bg-accent-purple text-white text-xs font-medium rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Popular
                </div>
              )}

              <div className="mb-4 pt-2">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                {plan.description && (
                  <p className="text-dark-400 text-sm mt-1">{plan.description}</p>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{formatPrice(plan.monthlyPriceCents)}</span>
                  {plan.monthlyPriceCents > 0 && <span className="text-dark-400 text-sm">/mo</span>}
                </div>
                {plan.annualDiscountPct > 0 && (
                  <p className="text-sm text-accent-emerald mt-1">
                    {annualPrice(plan.monthlyPriceCents, plan.annualDiscountPct)}/mo billed annually ({plan.annualDiscountPct}% off)
                  </p>
                )}
              </div>

              {/* Key features list */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                  <span className="text-dark-300">
                    {plan.userLimit === 0 ? 'Unlimited users' : `Up to ${plan.userLimit} user${plan.userLimit > 1 ? 's' : ''}`}
                  </span>
                </div>
                {hasCredits && plan.usageCreditsPerMonth > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                    <span className="text-dark-300">{plan.usageCreditsPerMonth.toLocaleString()} credits/month</span>
                  </div>
                )}
                {hasBonusCredits && plan.bonusCredits > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                    <span className="text-dark-300">{plan.bonusCredits.toLocaleString()} bonus credits</span>
                  </div>
                )}
                {entitlementKeys.map(({ key, description }) => {
                  const ent = plan.entitlements?.[key];
                  if (!ent) return null;
                  if (ent.type === 'bool' && !ent.boolValue) return null;
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                      <span className="text-dark-300">
                        {ent.type === 'bool' ? description : `${ent.numericValue} ${description}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CTA Button */}
              {isCurrent ? (
                <div className="w-full py-2.5 text-center text-sm font-medium text-primary-400 bg-primary-500/10 rounded-lg border border-primary-500/20">
                  Your Plan
                </div>
              ) : (
                <button
                  disabled
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isUpgrade
                      ? 'bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60'
                      : 'bg-dark-800 text-dark-300 border border-dark-700 disabled:opacity-60'
                  }`}
                >
                  {isUpgrade ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-dark-900/50 rounded-2xl border border-dark-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-800">
          <h3 className="text-lg font-semibold text-white">Plan Comparison</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-6 py-3 text-sm font-medium text-dark-400 min-w-[200px]">Feature</th>
                {sortedPlans.map(plan => (
                  <th key={plan.id} className={`text-center px-6 py-3 text-sm font-medium min-w-[140px] ${
                    plan.id === currentPlanId ? 'text-primary-400' : 'text-dark-400'
                  }`}>
                    {plan.name}
                    {plan.id === currentPlanId && (
                      <span className="block text-xs text-primary-400/60 font-normal mt-0.5">Current</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800/50">
              {/* Price Row */}
              <tr className="hover:bg-dark-800/20">
                <td className="px-6 py-3 text-sm text-dark-300">Monthly Price</td>
                {sortedPlans.map(plan => (
                  <td key={plan.id} className={`px-6 py-3 text-sm text-center ${plan.id === currentPlanId ? 'text-white font-medium' : 'text-dark-300'}`}>
                    {formatPrice(plan.monthlyPriceCents)}{plan.monthlyPriceCents > 0 ? '/mo' : ''}
                  </td>
                ))}
              </tr>

              {/* Annual Price Row */}
              {hasAnnual && (
                <tr className="hover:bg-dark-800/20">
                  <td className="px-6 py-3 text-sm text-dark-300">Annual Price</td>
                  {sortedPlans.map(plan => (
                    <td key={plan.id} className={`px-6 py-3 text-sm text-center ${plan.id === currentPlanId ? 'text-white font-medium' : 'text-dark-300'}`}>
                      {plan.annualDiscountPct > 0 ? (
                        <span>{annualPrice(plan.monthlyPriceCents, plan.annualDiscountPct)}/mo <span className="text-accent-emerald text-xs">({plan.annualDiscountPct}% off)</span></span>
                      ) : (
                        <span className="text-dark-500">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* User Limit Row */}
              <tr className="hover:bg-dark-800/20">
                <td className="px-6 py-3 text-sm text-dark-300">Users</td>
                {sortedPlans.map(plan => (
                  <td key={plan.id} className={`px-6 py-3 text-sm text-center ${plan.id === currentPlanId ? 'text-white font-medium' : 'text-dark-300'}`}>
                    {plan.userLimit === 0 ? 'Unlimited' : plan.userLimit}
                  </td>
                ))}
              </tr>

              {/* Usage Credits Row — only if any plan has credits */}
              {hasCredits && (
                <tr className="hover:bg-dark-800/20">
                  <td className="px-6 py-3 text-sm text-dark-300">Usage Credits / Month</td>
                  {sortedPlans.map(plan => (
                    <td key={plan.id} className={`px-6 py-3 text-sm text-center ${plan.id === currentPlanId ? 'text-white font-medium' : 'text-dark-300'}`}>
                      {plan.usageCreditsPerMonth > 0 ? plan.usageCreditsPerMonth.toLocaleString() : <span className="text-dark-500">—</span>}
                    </td>
                  ))}
                </tr>
              )}

              {/* Bonus Credits Row — only if any plan has bonus */}
              {hasBonusCredits && (
                <tr className="hover:bg-dark-800/20">
                  <td className="px-6 py-3 text-sm text-dark-300">Bonus Credits (one-time)</td>
                  {sortedPlans.map(plan => (
                    <td key={plan.id} className={`px-6 py-3 text-sm text-center ${plan.id === currentPlanId ? 'text-white font-medium' : 'text-dark-300'}`}>
                      {plan.bonusCredits > 0 ? plan.bonusCredits.toLocaleString() : <span className="text-dark-500">—</span>}
                    </td>
                  ))}
                </tr>
              )}

              {/* Entitlement Rows */}
              {entitlementKeys.map(({ key, description }) => (
                <tr key={key} className="hover:bg-dark-800/20">
                  <td className="px-6 py-3 text-sm text-dark-300">{description}</td>
                  {sortedPlans.map(plan => {
                    const ent: EntitlementValue | undefined = plan.entitlements?.[key];
                    return (
                      <td key={plan.id} className={`px-6 py-3 text-center ${plan.id === currentPlanId ? 'text-white' : 'text-dark-300'}`}>
                        {!ent ? (
                          <Minus className="w-4 h-4 text-dark-600 mx-auto" />
                        ) : ent.type === 'bool' ? (
                          ent.boolValue ? (
                            <Check className="w-5 h-5 text-accent-emerald mx-auto" />
                          ) : (
                            <Minus className="w-4 h-4 text-dark-600 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm font-medium">{ent.numericValue > 0 ? ent.numericValue.toLocaleString() : <Minus className="w-4 h-4 text-dark-600 mx-auto inline-block" />}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
