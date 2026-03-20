import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AIModel } from '../../../../types/aiarena';

interface BenchmarkSectionProps {
  benchmarks: any[];
  models: AIModel[];
}

const BenchmarkSection: React.FC<BenchmarkSectionProps> = ({ benchmarks, models }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group benchmarks by category
  const groupedBenchmarks = benchmarks.reduce((acc: Record<string, any[]>, benchmark: any) => {
    const category = benchmark._id?.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(benchmark);
    return acc;
  }, {});

  // Find best score for each benchmark
  const getBestScore = (scores: any[]): number => {
    if (!scores || scores.length === 0) return 0;
    return Math.max(...scores.map(s => s.score || 0));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900">Benchmark Comparison</h2>
          <p className="text-sm text-gray-500 mt-1">
            Click to {isExpanded ? 'collapse' : 'expand'} benchmark scores for these models
          </p>
        </div>
        <div className={`
          w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center
          transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}
        `}>
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <div className="min-w-[800px]">
            {Object.entries(groupedBenchmarks).map(([category, categoryBenchmarks]) => (
              <div key={category} className="border-b border-gray-100 last:border-b-0">
                {/* Category Header */}
                <div className="bg-gray-50 px-6 py-3 font-semibold text-sm text-gray-700 uppercase tracking-wider">
                  {category}
                </div>

                {/* Benchmark Rows */}
                <div className="divide-y divide-gray-100">
                  {categoryBenchmarks.map((benchmark: any) => {
                    const bestScore = getBestScore(benchmark.scores);
                    
                    return (
                      <div key={benchmark._id?.benchmark_id} className="grid grid-cols-[250px_repeat(auto-fit,minmax(150px,1fr))] gap-4 px-6 py-4">
                        {/* Benchmark Name */}
                        <div className="font-medium text-gray-900">
                          {benchmark._id?.name}
                        </div>

                        {/* Scores for each model */}
                        {models.map((model) => {
                          const score = benchmark.scores?.find(
                            (s: any) => s.model_id === model.id
                          );
                          const isBest = score?.score === bestScore && bestScore > 0;

                          return (
                            <div
                              key={model.id}
                              className={`
                                text-center py-2 px-3 rounded-lg
                                ${isBest ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600'}
                              `}
                            >
                              {score?.score_formatted || '—'}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BenchmarkSection;
