import React, { useState, useEffect } from 'react';
import { benchmarksApi, adminApi } from '../../../api/aiarena';
import { Benchmark, BenchmarkScore } from '../../../types/aiarena';
import { Plus, Edit, Trash2, Search, AlertCircle, Database } from 'lucide-react';

const AdminBenchmarks: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<Benchmark | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<Benchmark | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Benchmark>>({
    name: '',
    slug: '',
    category: '',
    description: '',
    url: '',
    is_active: true,
  });
  const [scoreForm, setScoreForm] = useState<Partial<BenchmarkScore>>({
    model_id: '',
    score: 0,
    score_formatted: '',
    source: 'manual',
    notes: '',
  });

  useEffect(() => {
    loadBenchmarks();
  }, [search]);

  const loadBenchmarks = async () => {
    setLoading(true);
    try {
      const response = await benchmarksApi.getAll();
      let data = response.data;
      if (search) {
        data = data.filter(b => 
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.category.toLowerCase().includes(search.toLowerCase())
        );
      }
      setBenchmarks(data);
    } catch (err) {
      setError('Failed to load benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminApi.createBenchmark(formData);
      setShowModal(false);
      resetForm();
      loadBenchmarks();
    } catch (err) {
      setError('Failed to create benchmark');
    }
  };

  const handleUpdate = async () => {
    if (!editingBenchmark) return;
    try {
      await adminApi.updateBenchmark(editingBenchmark.id, formData);
      setShowModal(false);
      setEditingBenchmark(null);
      resetForm();
      loadBenchmarks();
    } catch (err) {
      setError('Failed to update benchmark');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will also delete all associated scores.')) return;
    try {
      await adminApi.deleteBenchmark(id);
      loadBenchmarks();
    } catch (err) {
      setError('Failed to delete benchmark');
    }
  };

  const handleAddScore = async () => {
    if (!selectedBenchmark) return;
    try {
      await adminApi.createScore({
        ...scoreForm,
        benchmark_id: selectedBenchmark.id,
      });
      setShowScoreModal(false);
      setScoreForm({
        model_id: '',
        score: 0,
        score_formatted: '',
        source: 'manual',
        notes: '',
      });
    } catch (err) {
      setError('Failed to add score');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setEditingBenchmark(null);
    setShowModal(true);
  };

  const openEditModal = (benchmark: Benchmark) => {
    setEditingBenchmark(benchmark);
    setFormData({
      name: benchmark.name,
      slug: benchmark.slug,
      category: benchmark.category,
      description: benchmark.description,
      url: benchmark.url,
      is_active: benchmark.is_active,
    });
    setShowModal(true);
  };

  const openScoreModal = (benchmark: Benchmark) => {
    setSelectedBenchmark(benchmark);
    setShowScoreModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      category: '',
      description: '',
      url: '',
      is_active: true,
    });
  };

  // Group benchmarks by category
  const groupedBenchmarks = benchmarks.reduce((acc: Record<string, Benchmark[]>, b) => {
    if (!acc[b.category]) acc[b.category] = [];
    acc[b.category].push(b);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benchmarks</h1>
          <p className="text-sm text-gray-500">Manage benchmark categories and scores</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Benchmark
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search benchmarks..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedBenchmarks).map(([category, categoryBenchmarks]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                {category}
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {categoryBenchmarks.map((benchmark) => (
                      <tr key={benchmark.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{benchmark.name}</div>
                          <div className="text-sm text-gray-500">{benchmark.slug}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-md">
                          <div className="line-clamp-2">{benchmark.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          {benchmark.url && (
                            <a 
                              href={benchmark.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              View Source
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            benchmark.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {benchmark.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openScoreModal(benchmark)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Add Score"
                            >
                              <Database className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(benchmark)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(benchmark.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Benchmark Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingBenchmark ? 'Edit Benchmark' : 'Add New Benchmark'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., human-eval"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Coding, Knowledge, Math"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <label className="text-sm font-medium text-gray-700">Active</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={editingBenchmark ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingBenchmark ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Modal */}
      {showScoreModal && selectedBenchmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                Add Score for {selectedBenchmark.name}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model ID</label>
                  <input
                    type="text"
                    value={scoreForm.model_id}
                    onChange={(e) => setScoreForm({ ...scoreForm, model_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="MongoDB ObjectId"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score (0-100)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={scoreForm.score}
                    onChange={(e) => {
                      const score = parseFloat(e.target.value);
                      setScoreForm({ 
                        ...scoreForm, 
                        score,
                        score_formatted: score.toFixed(1) + '%'
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={scoreForm.source}
                    onChange={(e) => setScoreForm({ ...scoreForm, source: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="manual">Manual</option>
                    <option value="huggingface">HuggingFace</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={scoreForm.notes}
                    onChange={(e) => setScoreForm({ ...scoreForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddScore}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBenchmarks;
