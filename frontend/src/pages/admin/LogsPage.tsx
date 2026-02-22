import { useEffect, useState, useCallback } from 'react';
import { FileText, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import type { SystemLog, LogSeverity } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

const severityConfig: Record<LogSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/10' },
  medium:   { label: 'Medium',   color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low:      { label: 'Low',      color: 'text-blue-400', bg: 'bg-blue-500/10' },
  debug:    { label: 'Debug',    color: 'text-dark-400', bg: 'bg-dark-700/50' },
};

const PER_PAGE = 50;

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [userId, setUserId] = useState(searchParams.get('userId') || '');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, perPage: PER_PAGE };
      if (severity) params.severity = severity;
      if (search) params.search = search;
      if (userId) params.userId = userId;
      const data = await adminApi.listLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, severity, search, userId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleSeverityChange = (sev: string) => {
    setPage(1);
    setSeverity(sev);
  };

  const clearUserFilter = () => {
    setUserId('');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary-400" />
            System Logs
          </h1>
          <p className="text-dark-400 mt-1">{total} log entries</p>
        </div>
      </div>

      {/* Active user filter chip */}
      {userId && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/10 border border-primary-500/20 rounded-lg text-sm text-primary-400">
            Filtered by user: <span className="font-mono">{userId.slice(-8)}</span>
            <button onClick={clearUserFilter} className="ml-1 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="px-4 py-2 bg-dark-800 border border-dark-700 text-dark-300 text-sm rounded-lg hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        <select
          value={severity}
          onChange={(e) => handleSeverityChange(e.target.value)}
          className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="debug">Debug</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : logs.length === 0 ? (
        <div className="bg-dark-900/50 border border-dark-800 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400">No log entries found</p>
        </div>
      ) : (
        <>
          <div className="bg-dark-900/50 border border-dark-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-dark-400 font-medium w-44">Timestamp</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium w-28">Severity</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium w-24">User</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const sev = severityConfig[log.severity] || severityConfig.debug;
                  return (
                    <tr key={log.id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                      <td className="px-4 py-3 text-dark-400 whitespace-nowrap font-mono text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${sev.color} ${sev.bg}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.userId ? (
                          <Link
                            to={`/last/users/${log.userId}`}
                            className="text-primary-400 hover:text-primary-300 text-xs font-mono transition-colors"
                          >
                            {log.userId.slice(-8)}
                          </Link>
                        ) : (
                          <span className="text-dark-500 text-xs">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-dark-200 break-all">
                        {log.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-dark-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-300 hover:text-white disabled:opacity-40 disabled:hover:text-dark-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-300 hover:text-white disabled:opacity-40 disabled:hover:text-dark-300 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
