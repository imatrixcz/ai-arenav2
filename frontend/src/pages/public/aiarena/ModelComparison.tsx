import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modelsApi } from '../../api/aiarena';
import { AIModel, BenchmarkScore } from '../../types/aiarena';
import ModelCard from './components/ModelCard';
import BenchmarkSection from './components/BenchmarkSection';
import AddModelModal from './components/AddModelModal';
import { Plus, ArrowLeftRight } from 'lucide-react';

const ModelComparison: React.FC = () => {
  const { slugs } = useParams<{ slugs: string }>();
  const navigate = useNavigate();
  
  const [models, setModels] = useState<AIModel[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slugs) {
      loadComparison(slugs);
    }
  }, [slugs]);

  const loadComparison = async (modelSlugs: string) => {
    setLoading(true);
    try {
      const slugList = modelSlugs.split('-vs-');
      const response = await modelsApi.compare(slugList);
      setModels(response.data.models);
      setBenchmarks(response.data.benchmarks);
    } catch (error) {
      console.error('Failed to load comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newModels = [...models];
    const [movedModel] = newModels.splice(fromIndex, 1);
    newModels.splice(toIndex, 0, movedModel);
    setModels(newModels);
    
    // Update URL
    const newSlugs = newModels.map(m => m.slug).join('-vs-');
    navigate(`/compare/${newSlugs}`, { replace: true });
  };

  const handleRemoveModel = (slug: string) => {
    const newModels = models.filter(m => m.slug !== slug);
    setModels(newModels);
    
    if (newModels.length === 0) {
      navigate('/models');
    } else {
      const newSlugs = newModels.map(m => m.slug).join('-vs-');
      navigate(`/compare/${newSlugs}`, { replace: true });
    }
  };

  const handleAddModels = (newSlugs: string[]) => {
    const existingSlugs = models.map(m => m.slug);
    const allSlugs = [...existingSlugs, ...newSlugs];
    const uniqueSlugs = allSlugs.filter((s, i) => allSlugs.indexOf(s) === i);
    
    const slugsString = uniqueSlugs.join('-vs-');
    navigate(`/compare/${slugsString}`);
    setIsModalOpen(false);
  };

  // Calculate best values
  const bestValues = React.useMemo(() => {
    if (models.length === 0) return {};
    
    const best: Record<string, { value: number | null; modelIds: string[] }> = {
      context_length: { value: null, modelIds: [] },
      pricing_prompt: { value: null, modelIds: [] },
      pricing_completion: { value: null, modelIds: [] },
      max_output_tokens: { value: null, modelIds: [] },
    };

    models.forEach(model => {
      // Best context length (highest)
      if (model.context_length > (best.context_length.value || 0)) {
        best.context_length.value = model.context_length;
        best.context_length.modelIds = [model.id];
      } else if (model.context_length === best.context_length.value) {
        best.context_length.modelIds.push(model.id);
      }

      // Best pricing (lowest, > 0)
      if (model.pricing.prompt > 0) {
        if (best.pricing_prompt.value === null || model.pricing.prompt < best.pricing_prompt.value) {
          best.pricing_prompt.value = model.pricing.prompt;
          best.pricing_prompt.modelIds = [model.id];
        } else if (model.pricing.prompt === best.pricing_prompt.value) {
          best.pricing_prompt.modelIds.push(model.id);
        }
      }

      if (model.pricing.completion > 0) {
        if (best.pricing_completion.value === null || model.pricing.completion < best.pricing_completion.value) {
          best.pricing_completion.value = model.pricing.completion;
          best.pricing_completion.modelIds = [model.id];
        } else if (model.pricing.completion === best.pricing_completion.value) {
          best.pricing_completion.modelIds.push(model.id);
        }
      }

      // Best max output (highest)
      if (model.max_output_tokens > (best.max_output_tokens.value || 0)) {
        best.max_output_tokens.value = model.max_output_tokens;
        best.max_output_tokens.modelIds = [model.id];
      } else if (model.max_output_tokens === best.max_output_tokens.value) {
        best.max_output_tokens.modelIds.push(model.id);
      }
    });

    return best;
  }, [models]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Model Comparison
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Drag to reorder • Click menu for options
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Model
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Model Cards */}
        <div className="flex flex-wrap gap-6 mb-8">
          {models.map((model, index) => (
            <ModelCard
              key={model.id}
              model={model}
              index={index}
              bestValues={bestValues}
              onRemove={handleRemoveModel}
              onReorder={handleReorder}
              isDragging={draggingIndex === index}
              onDragStart={() => setDraggingIndex(index)}
              onDragEnd={() => setDraggingIndex(null)}
            />
          ))}
          
          {/* Add Model Card */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-80 h-[400px] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-4 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            <Plus className="w-12 h-12" />
            <span className="font-medium">Add Model</span>
          </button>
        </div>

        {/* Benchmark Section */}
        {benchmarks.length > 0 && (
          <BenchmarkSection 
            benchmarks={benchmarks} 
            models={models}
          />
        )}
      </div>

      {/* Add Model Modal */}
      {isModalOpen && (
        <AddModelModal
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAddModels}
          existingSlugs={models.map(m => m.slug)}
        />
      )}
    </div>
  );
};

export default ModelComparison;
