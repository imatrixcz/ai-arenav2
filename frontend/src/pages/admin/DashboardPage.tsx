import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, Activity } from 'lucide-react';
import { adminApi } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{ users: number; tenants: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.listUsers(), adminApi.listTenants()])
      .then(([usersData, tenantsData]) => {
        setStats({ users: usersData.users.length, tenants: tenantsData.tenants.length });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-dark-400 mt-1">System overview and management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          to="/last/users"
          className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-6 hover:border-dark-700 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-dark-400">Total Users</p>
              <p className="text-2xl font-bold text-white">{stats?.users ?? 0}</p>
            </div>
          </div>
        </Link>

        <Link
          to="/last/tenants"
          className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-6 hover:border-dark-700 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-accent-purple" />
            </div>
            <div>
              <p className="text-sm text-dark-400">Tenants</p>
              <p className="text-2xl font-bold text-white">{stats?.tenants ?? 0}</p>
            </div>
          </div>
        </Link>

        <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-emerald/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent-emerald" />
            </div>
            <div>
              <p className="text-sm text-dark-400">System Status</p>
              <p className="text-lg font-semibold text-accent-emerald">Healthy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
