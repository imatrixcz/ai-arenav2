import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Shield, Zap } from 'lucide-react';
import { adminApi } from '../../api/client';
import type { TenantListItem } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TenantsPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = () => {
    adminApi.listTenants()
      .then((data) => setTenants(data.tenants))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTenants(); }, []);

  const toggleStatus = async (tenant: TenantListItem) => {
    if (tenant.isRoot) return; // Can't disable root tenant
    try {
      await adminApi.updateTenantStatus(tenant.id, !tenant.isActive);
      setTenants(tenants.map(t => t.id === tenant.id ? { ...t, isActive: !t.isActive } : t));
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-accent-purple" />
            Tenants
          </h1>
          <p className="text-dark-400 mt-1">{tenants.length} total tenants</p>
        </div>
      </div>

      <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-800">
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Plan</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Credits</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Members</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Created</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Status</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-dark-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/last/tenants/${tenant.id}`)}
                      className="text-sm font-medium text-white hover:text-primary-400 transition-colors text-left"
                    >
                      {tenant.name}
                    </button>
                    {tenant.isRoot && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-purple/10 text-accent-purple">
                        <Shield className="w-3 h-3" />
                        Root
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-dark-500 font-mono">{tenant.slug}</div>
                </td>
                <td className="px-6 py-4 text-sm text-dark-300">{tenant.planName}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm text-dark-300">
                    <Zap className="w-3.5 h-3.5 text-primary-400" />
                    {(tenant.subscriptionCredits + tenant.purchasedCredits).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-dark-300">{tenant.memberCount}</td>
                <td className="px-6 py-4 text-sm text-dark-400">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tenant.isActive
                      ? 'bg-accent-emerald/10 text-accent-emerald'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {tenant.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {!tenant.isRoot && (
                    <button
                      onClick={() => toggleStatus(tenant)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        tenant.isActive
                          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          : 'border-accent-emerald/30 text-accent-emerald hover:bg-accent-emerald/10'
                      }`}
                    >
                      {tenant.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
