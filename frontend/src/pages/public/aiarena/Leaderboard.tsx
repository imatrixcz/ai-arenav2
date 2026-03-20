import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaderboardApi } from '../../../api/aiarena';
import { LeaderboardEntry } from '../../../types/aiarena';
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

const modalities = [
  { id: 'global', name: 'Global', icon: '🏆' },
  { id: 'code', name: 'Code', icon: '💻' },
  { id: 'image', name: 'Image', icon: '🖼️' },
  { id: 'video', name: 'Video', icon: '🎬' },
  { id: 'audio', name: 'Audio', icon: '🎵' },
  { id: 'text', name: 'Text', icon: '📝' },
  { id: 'vision', name: 'Vision', icon: '👁️' },
];

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModality, setSelectedModality] = useState('global');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedModality, page]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await leaderboardApi.get(selectedModality, page, 50);
      setEntries(response.data.entries);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-6 h-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-400 w-6 text-center">{rank}</span>;
  };

  const getTrendIcon = (entry: LeaderboardEntry) => {
    // This would require historical data - simplified for now
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI Model Rankings by ELO Rating
              </p>
            </div>
          </div>

          {/* Modality Filter */}
          <div className="mt-6 flex flex-wrap gap-2">
            {modalities.map((modality) => (
              <button
                key={modality.id}
                onClick={() => {
                  setSelectedModality(modality.id);
                  setPage(1);
                }}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${selectedModality === modality.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                `}
              >
                <span>{modality.icon}</span>
                <span>{modality.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div>Rank</div>
              <div>Model</div>
              <div className="text-right">ELO Rating</div>
              <div className="text-right">Trend</div>
            </div>

            {/* Entries */}
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => navigate(`/models/${entry.slug}`)}
                  className={`
                    grid grid-cols-[80px_1fr_120px_100px] gap-4 px-6 py-4 items-center
                    hover:bg-gray-50 cursor-pointer transition-colors
                    ${entry.rank <= 3 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent' : ''}
                  `}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-2">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Model Info */}
                  <div>
                    <div className="font-semibold text-gray-900">{entry.name}</div>
                    <div className="text-sm text-gray-500">{entry.provider}</div>
                    <div className="flex gap-1 mt-1">
                      {entry.modalities?.slice(0, 4).map((mod) => (
                        <span key={mod} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ELO Rating */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {Math.round(entry.score)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Global: {Math.round(entry.elo_ratings.global)}
                    </div>
                  </div>

                  {/* Trend */}
                  <div className="flex justify-end">
                    {getTrendIcon(entry)}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {entries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No entries found for this category.
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-600">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={entries.length < 50}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
