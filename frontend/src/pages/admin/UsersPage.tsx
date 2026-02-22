import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../../api/client';
import type { UserListItem } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    adminApi.listUsers()
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleStatus = async (user: UserListItem) => {
    try {
      await adminApi.updateUserStatus(user.id, !user.isActive);
      setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
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
            <Users className="w-7 h-7 text-primary-400" />
            Users
          </h1>
          <p className="text-dark-400 mt-1">{users.length} total users</p>
        </div>
      </div>

      <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-800">
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">User</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Email Verified</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Tenants</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Joined</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Status</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-dark-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} onClick={() => navigate(`/last/users/${user.id}`)} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">{user.displayName}</p>
                    <p className="text-xs text-dark-500">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.emailVerified ? (
                    <CheckCircle className="w-4 h-4 text-accent-emerald" />
                  ) : (
                    <XCircle className="w-4 h-4 text-dark-500" />
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-dark-300">{user.tenantCount}</td>
                <td className="px-6 py-4 text-sm text-dark-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive
                      ? 'bg-accent-emerald/10 text-accent-emerald'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStatus(user); }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      user.isActive
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'border-accent-emerald/30 text-accent-emerald hover:bg-accent-emerald/10'
                    }`}
                  >
                    {user.isActive ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
