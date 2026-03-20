import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { modelsApi } from '../../../../api/aiarena';
import { AIModel } from '../../../../types/aiarena';

interface AddModelModalProps {
  onClose: () => void;
  onAdd: (slugs: string[]) => void;
  existingSlugs: string[];
}

const AddModelModal: React.FC<AddModelModalProps> = ({ onClose, onAdd, existingSlugs }) => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [providers, setProviders] = useState<{ _id: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsRes, providersRes] = await Promise.all([
        modelsApi.getAll({ per_page: 1000 }),
        modelsApi.getProviders(),
      ]);
      
      // Filter out existing models
      const availableModels = modelsRes.data.models.filter(
        m => !existingSlugs.includes(m.slug)
      );
      
      setModels(availableModels);
      setProviders(providersRes.data);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesSearch = 
        model.name.toLowerCase().includes(search.toLowerCase()) ||
        model.provider.toLowerCase().includes(search.toLowerCase());
      const matchesProvider = !selectedProvider || model.provider === selectedProvider;
      return matchesSearch && matchesProvider;
    });
  }, [models, search, selectedProvider]);

  const toggleModel = (slug: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedModels(newSelected);
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedModels));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Add Model to Comparison</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedProvider(null)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-colors
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
                  px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${selectedProvider === provider._id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                `}
              >
                {provider._id}
              </button>
            ))}
          </div>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => toggleModel(model.slug)}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${selectedModels.has(model.slug)
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50 border-transparent'}
                    border
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${selectedModels.has(model.slug)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'}
                  `}>
                    {selectedModels.has(model.slug) && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{model.name}</div>
                    <div className="text-sm text-gray-500">{model.provider}</div>
                  </div>
                </div>
              ))}
              
              {filteredModels.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No models found matching your criteria.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedModels.size} model{selectedModels.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedModels.size === 0}
              className={`
                px-6 py-2 rounded-lg font-medium transition-colors
                ${selectedModels.size > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
              `}
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddModelModal;
