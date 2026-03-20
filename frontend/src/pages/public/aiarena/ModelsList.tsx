import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { modelsApi } from '../../../api/aiarena';
import { AIModel } from '../../../types/aiarena';
import { Search, Filter, ChevronDown, Grid, List, BarChart3 } from 'lucide-react';

const ModelsList: React.FC = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState<AIModel[]>([]);
  const [providers, setProviders] = useState<{ _id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [search, selectedProvider, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsRes, providersRes] = await Promise.all([
        modelsApi.getAll({
          search: search || undefined,
          provider: selectedProvider || undefined,
          page,
          per_page: 24,
        }),
        modelsApi.getProviders(),
      ]);

      setModels(modelsRes.data.models);
      setTotalPages(modelsRes.data.pagination.pages);
      setProviders(providersRes.data);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModelSelection = (slug: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedModels(newSelected);
  };

  const handleCompare = () => {
    if (selectedModels.size >= 2) {
      const slugs = Array.from(selectedModels).join('-vs-');
      navigate(`/compare/${slugs}`);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Models</h1>
              <p className="text-sm text-gray-500 mt-1">
                Compare and explore {models.length}+ AI models
              </p>
            </div>

            {selectedModels.size >= 2 && (
              <button
                onClick={handleCompare}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
                Compare ({selectedModels.size})
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Provider Filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => setSelectedProvider(null)}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${!selectedProvider
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                `}
              >
                All
              </button>
              {providers.map((provider) => (
                <button
                  key={provider._id}
                  onClick={() => setSelectedProvider(provider._id)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                    ${selectedProvider === provider._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {provider._id} ({provider.count})
                </button>
              ))}
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {models.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => navigate(`/models/${model.slug}`)}
                    className={`
                      bg-white rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg
                      ${selectedModels.has(model.slug)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200'}
                    `}
                  >
                    {/* Checkbox */}
                    <div
                      className="flex items-center gap-3 mb-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModelSelection(model.slug);
                      }}
                    >
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${selectedModels.has(model.slug)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'}
                      `}>
                        {selectedModels.has(model.slug) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Header */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {model.provider}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">
                        {model.name}
                      </h3>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Context</span>
                        <span className="font-medium">{formatNumber(model.context_length)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Input</span>
                        <span className="font-medium">
                          ${model.pricing.prompt.toFixed(2)}/1M
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Output</span>
                        <span className="font-medium">
                          ${model.pricing.completion.toFixed(2)}/1M
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex gap-1">
                        {model.modalities?.slice(0, 3).map((mod) => (
                          <span key={mod} className="text-lg" title={mod}>
                            {mod === 'text' && '📝'}
                            {mod === 'image' && '🖼️'}
                            {mod === 'video' && '🎬'}
                            {mod === 'audio' && '🎵'}
                            {mod === 'file' && '📎'}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        ELO: {Math.round(model.elo_ratings.global)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedModels.size === models.length && models.length > 0}
                          onChange={() => {
                            if (selectedModels.size === models.length) {
                              setSelectedModels(new Set());
                            } else {
                              setSelectedModels(new Set(models.map(m => m.slug)));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Context</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Input $/1M</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output $/1M</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ELO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {models.map((model) => (
                      <tr
                        key={model.id}
                        onClick={() => navigate(`/models/${model.slug}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedModels.has(model.slug)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleModelSelection(model.slug);
                            }}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{model.name}</td>
                        <td className="px-6 py-4 text-gray-600">{model.provider}</td>
                        <td className="px-6 py-4 text-gray-600">{formatNumber(model.context_length)}</td>
                        <td className="px-6 py-4 text-gray-600">${model.pricing.prompt.toFixed(2)}</td>
                        <td className="px-6 py-4 text-gray-600">${model.pricing.completion.toFixed(2)}</td>
                        <td className="px-6 py-4 font-semibold">{Math.round(model.elo_ratings.global)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ModelsList;
