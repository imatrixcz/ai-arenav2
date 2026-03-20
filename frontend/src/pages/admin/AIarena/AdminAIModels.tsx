import React, { useState, useEffect } from 'react';
import { adminApi, modelsApi } from '../../../api/aiarena';
import { AIModel } from '../../../types/aiarena';
import { Plus, Edit, Trash2, RefreshCw, Search, AlertCircle } from 'lucide-react';

const AdminAIModels: React.FC = () => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AIModel>>({
    name: '',
    provider: '',
    description: '',
    context_length: 0,
    max_output_tokens: 0,
    pricing: { prompt: 0, completion: 0, image: 0, tiers: [] },
    modalities: ['text'],
    is_active: true,
  });

  useEffect(() => {
    loadModels();
  }, [search]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await modelsApi.getAll({ 
        search: search || undefined, 
        per_page: 100 
      });
      setModels(response.data.models);
    } catch (err) {
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRouterSync = async () => {
    setSyncing(true);
    try {
      await adminApi.syncOpenRouter();
      alert('OpenRouter sync started! Check sync logs for details.');
    } catch (err) {
      setError('Failed to start sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminApi.createModel(formData);
      setShowModal(false);
      resetForm();
      loadModels();
    } catch (err) {
      setError('Failed to create model');
    }
  };

  const handleUpdate = async () => {
    if (!editingModel) return;
    try {
      await adminApi.updateModel(editingModel.id, formData);
      setShowModal(false);
      setEditingModel(null);
      resetForm();
      loadModels();
    } catch (err) {
      setError('Failed to update model');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await adminApi.deleteModel(id);
      loadModels();
    } catch (err) {
      setError('Failed to delete model');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setEditingModel(null);
    setShowModal(true);
  };

  const openEditModal = (model: AIModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      provider: model.provider,
      description: model.description,
      context_length: model.context_length,
      max_output_tokens: model.max_output_tokens,
      pricing: model.pricing,
      modalities: model.modalities,
      is_active: model.is_active,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider: '',
      description: '',
      context_length: 0,
      max_output_tokens: 0,
      pricing: { prompt: 0, completion: 0, image: 0, tiers: [] },
      modalities: ['text'],
      is_active: true,
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Models</h1>
          <p className="text-sm text-gray-500">Manage AI models in the arena</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenRouterSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync OpenRouter
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Model
          </button>
        </div>
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
            placeholder="Search models..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Context</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price In/Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ELO</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{model.name}</div>
                    <div className="text-sm text-gray-500">{model.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{model.provider}</td>
                  <td className="px-6 py-4 text-gray-600">{formatNumber(model.context_length)}</td>
                  <td className="px-6 py-4 text-gray-600">
                    ${model.pricing.prompt.toFixed(2)} / ${model.pricing.completion.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-semibold">{Math.round(model.elo_ratings.global)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      model.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {model.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {model.manual_override && (
                      <span className="ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(model)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(model.id)}
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
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingModel ? 'Edit Model' : 'Add New Model'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Context Length</label>
                    <input
                      type="number"
                      value={formData.context_length}
                      onChange={(e) => setFormData({ ...formData, context_length: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Output Tokens</label>
                    <input
                      type="number"
                      value={formData.max_output_tokens}
                      onChange={(e) => setFormData({ ...formData, max_output_tokens: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Input Price ($/1M)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pricing?.prompt}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        pricing: { ...formData.pricing!, prompt: parseFloat(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Output Price ($/1M)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pricing?.completion}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        pricing: { ...formData.pricing!, completion: parseFloat(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-5 h-5 mt-2"
                    />
                  </div>
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
                  onClick={editingModel ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingModel ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAIModels;
