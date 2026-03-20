import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modelsApi } from '../../../api/aiarena';
import { AIModel, BenchmarkScore } from '../../../types/aiarena';
import { ArrowLeft, BarChart3, Calendar, DollarSign, Cpu, Shield, Sparkles, ExternalLink, Plus } from 'lucide-react';

const ModelDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<AIModel | null>(null);
  const [scores, setScores] = useState<BenchmarkScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await modelsApi.getBySlug(slug!);
      setModel(response.data.model);
      setScores(response.data.scores);
    } catch (err) {
      setError('Failed to load model details.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  const formatPrice = (price: number): string => {
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}`;
  };

  const getModalityIcon = (modality: string): string => {
    const icons: Record<string, string> = {
      text: '📝',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      file: '📎',
    };
    return icons[modality] || '📦';
  };

  const getModalityColor = (modality: string): string => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-700',
      image: 'bg-green-100 text-green-700',
      video: 'bg-purple-100 text-purple-700',
      audio: 'bg-red-100 text-red-700',
      file: 'bg-orange-100 text-orange-700',
    };
    return colors[modality] || 'bg-gray-100 text-gray-700';
  };

  // Group scores by category
  const groupedScores = scores.reduce((acc: Record<string, BenchmarkScore[]>, score) => {
    const category = score.benchmark_category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(score);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Model not found'}</p>
          <button
            onClick={() => navigate('/models')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Models
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/models')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
                {model.is_moderated && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    <Shield className="w-3 h-3" />
                    Moderated
                  </span>
                )}
                {model.manual_override && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Manual
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">{model.provider}</p>
            </div>
            <button
              onClick={() => navigate(`/compare/${model.slug}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Compare
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Info */}
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-600">{model.description || 'No description available.'}</p>
            </div>

            {/* Capabilities */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Capabilities</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Cpu className="w-5 h-5" />
                    <span>Context Length</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatNumber(model.context_length)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Cpu className="w-5 h-5" />
                    <span>Max Output</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatNumber(model.max_output_tokens)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-5 h-5" />
                    <span>Release Date</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {model.release_date ? new Date(model.release_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>Version</span>
                  </div>
                  <span className="font-semibold text-gray-900">{model.version || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Modalities */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Modalities</h2>
              <div className="flex flex-wrap gap-2">
                {model.modalities?.map((modality) => (
                  <span
                    key={modality}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getModalityColor(modality)}`}
                  >
                    <span>{getModalityIcon(modality)}</span>
                    <span className="capitalize">{modality}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Pricing (per 1M tokens)
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Input</span>
                  <span className="font-semibold text-gray-900">{formatPrice(model.pricing.prompt)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Output</span>
                  <span className="font-semibold text-gray-900">{formatPrice(model.pricing.completion)}</span>
                </div>
                {model.pricing.image > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Image</span>
                    <span className="font-semibold text-gray-900">{formatPrice(model.pricing.image)}</span>
                  </div>
                )}
              </div>
              
              {/* Tiered Pricing */}
              {model.pricing.tiers && model.pricing.tiers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Tiered Pricing</h3>
                  <div className="space-y-2">
                    {model.pricing.tiers.map((tier, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-gray-500">{tier.label}:</span>
                        <span className="ml-2 font-medium">${tier.prompt_price.toFixed(2)} / ${tier.completion_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - ELO & Benchmarks */}
          <div className="lg:col-span-2 space-y-6">
            {/* ELO Ratings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                ELO Ratings
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'global', label: 'Global', value: model.elo_ratings.global },
                  { key: 'code', label: 'Code', value: model.elo_ratings.code },
                  { key: 'image', label: 'Image', value: model.elo_ratings.image },
                  { key: 'video', label: 'Video', value: model.elo_ratings.video },
                  { key: 'audio', label: 'Audio', value: model.elo_ratings.audio },
                  { key: 'text', label: 'Text', value: model.elo_ratings.text },
                  { key: 'vision', label: 'Vision', value: model.elo_ratings.vision },
                ].map((rating) => (
                  <div
                    key={rating.key}
                    className={`p-4 rounded-lg text-center ${
                      rating.key === 'global' ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-sm text-gray-600 mb-1">{rating.label}</div>
                    <div className={`text-2xl font-bold ${
                      rating.key === 'global' ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {Math.round(rating.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Benchmark Scores */}
            {Object.keys(groupedScores).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Benchmark Scores</h2>
                <div className="space-y-6">
                  {Object.entries(groupedScores).map(([category, categoryScores]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {categoryScores.map((score) => (
                          <div
                            key={score.id}
                            className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <span className="font-medium text-gray-900">{score.benchmark_name}</span>
                              {score.notes && (
                                <p className="text-sm text-gray-500 mt-0.5">{score.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-gray-900">{score.score_formatted}</span>
                              {score.url && (
                                <a
                                  href={score.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="w-4 h-4 inline" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Architecture:</span>
                  <span className="ml-2 font-medium">{model.architecture || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Tokenizer:</span>
                  <span className="ml-2 font-medium">{model.tokenizer || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">OpenRouter ID:</span>
                  <span className="ml-2 font-medium">{model.openrouter_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Source:</span>
                  <span className="ml-2 font-medium capitalize">{model.source}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelDetail;
