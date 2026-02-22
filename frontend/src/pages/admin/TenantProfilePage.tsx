import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Zap, Users } from 'lucide-react';
import { adminApi } from '../../api/client';
import type { TenantDetail, TenantMember, Plan } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TenantProfilePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Edit fields
  const [name, setName] = useState('');
  const [billingWaived, setBillingWaived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Credit fields
  const [subscriptionCredits, setSubscriptionCredits] = useState(0);
  const [purchasedCredits, setPurchasedCredits] = useState(0);
  const [savingCredits, setSavingCredits] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [creditSuccess, setCreditSuccess] = useState('');

  // Plan name lookup
  const [planName, setPlanName] = useState('Free');

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [tenantData, plansData] = await Promise.all([
        adminApi.getTenant(tenantId),
        adminApi.listPlans(),
      ]);
      setTenant(tenantData.tenant);
      setMembers(tenantData.members || []);
      setName(tenantData.tenant.name);
      setBillingWaived(tenantData.tenant.billingWaived);
      setSubscriptionCredits(tenantData.tenant.subscriptionCredits);
      setPurchasedCredits(tenantData.tenant.purchasedCredits);

      // Resolve plan name
      const plans = plansData.plans || [];
      if (tenantData.tenant.planId) {
        const p = plans.find((pl: Plan) => pl.id === tenantData.tenant.planId);
        if (p) setPlanName(p.name);
      } else {
        const sys = plans.find((pl: Plan) => pl.isSystem);
        if (sys) setPlanName(sys.name);
      }
    } catch {
      setFetchError('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const updates: { name?: string; billingWaived?: boolean } = {};
      if (name.trim() !== tenant.name) updates.name = name.trim();
      if (billingWaived !== tenant.billingWaived) updates.billingWaived = billingWaived;
      if (Object.keys(updates).length === 0) {
        setSaveSuccess('No changes to save');
        setSaving(false);
        return;
      }
      await adminApi.updateTenant(tenant.id, updates);
      setSaveSuccess('Tenant updated successfully');
      await fetchTenant();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update tenant';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredits = async () => {
    if (!tenant) return;
    setSavingCredits(true);
    setCreditError('');
    setCreditSuccess('');
    try {
      const updates: { subscriptionCredits?: number; purchasedCredits?: number } = {};
      if (subscriptionCredits !== tenant.subscriptionCredits) updates.subscriptionCredits = subscriptionCredits;
      if (purchasedCredits !== tenant.purchasedCredits) updates.purchasedCredits = purchasedCredits;
      if (Object.keys(updates).length === 0) {
        setCreditSuccess('No changes to save');
        setSavingCredits(false);
        return;
      }
      await adminApi.updateTenant(tenant.id, updates);
      setCreditSuccess('Credits updated successfully');
      await fetchTenant();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update credits';
      setCreditError(msg);
    } finally {
      setSavingCredits(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    try {
      await adminApi.updateTenantStatus(tenant.id, !tenant.isActive);
      await fetchTenant();
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  if (fetchError || !tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{fetchError || 'Tenant not found'}</p>
        <button onClick={() => navigate('/last/tenants')} className="text-primary-400 hover:underline">
          Back to Tenants
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link to="/last/tenants" className="text-dark-400 hover:text-white text-sm flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tenants
        </Link>
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-primary-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Tenant Profile</h1>
            <p className="text-dark-400 text-sm">{tenant.name} &middot; {tenant.slug}</p>
          </div>
          {tenant.isRoot && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">Root</span>
          )}
        </div>
      </div>

      {/* Tenant Information */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Tenant Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Slug</label>
            <div className="px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-dark-400 text-sm font-mono">
              {tenant.slug}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Plan</label>
            <div className="px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-dark-300 text-sm">
              {planName}
            </div>
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Billing Waived</label>
            <button
              onClick={() => setBillingWaived(!billingWaived)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                billingWaived
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-dark-800 text-dark-400 border-dark-700'
              }`}
            >
              {billingWaived ? 'Yes' : 'No'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saveError && <span className="text-red-400 text-sm">{saveError}</span>}
          {saveSuccess && <span className="text-green-400 text-sm">{saveSuccess}</span>}
        </div>
      </div>

      {/* Usage Credits */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary-400" />
          Usage Credits
        </h2>
        <p className="text-dark-400 text-sm mb-4">
          Total balance: <span className="text-white font-semibold">{(subscriptionCredits + purchasedCredits).toLocaleString()}</span> credits
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Subscription Credits</label>
            <p className="text-xs text-dark-500 mb-1">From monthly plan allotment (resets monthly if policy is &ldquo;reset&rdquo;)</p>
            <input
              type="text"
              inputMode="numeric"
              value={subscriptionCredits}
              onChange={(e) => setSubscriptionCredits(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Purchased &amp; Bonus Credits</label>
            <p className="text-xs text-dark-500 mb-1">From one-time purchases and bonuses (never reset)</p>
            <input
              type="text"
              inputMode="numeric"
              value={purchasedCredits}
              onChange={(e) => setPurchasedCredits(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCredits}
            disabled={savingCredits}
            className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingCredits ? 'Saving...' : 'Save Credits'}
          </button>
          {creditError && <span className="text-red-400 text-sm">{creditError}</span>}
          {creditSuccess && <span className="text-green-400 text-sm">{creditSuccess}</span>}
        </div>
      </div>

      {/* Account Status */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account Status</h2>
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            tenant.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {tenant.isActive ? 'Active' : 'Disabled'}
          </span>
          {!tenant.isRoot && (
            <button
              onClick={handleToggleStatus}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                tenant.isActive
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
              }`}
            >
              {tenant.isActive ? 'Disable Tenant' : 'Enable Tenant'}
            </button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="bg-dark-900/50 border border-dark-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-dark-400" />
          Members
          <span className="text-sm font-normal text-dark-500">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="text-dark-400 text-sm">No members in this tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-800 text-dark-400 text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.userId}
                    onClick={() => navigate(`/last/users/${m.userId}`)}
                    className="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 text-white">{m.displayName}</td>
                    <td className="py-3 text-dark-300">{m.email}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        m.role === 'owner' ? 'bg-amber-500/20 text-amber-400' :
                        m.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-dark-700 text-dark-300'
                      }`}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 text-dark-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
