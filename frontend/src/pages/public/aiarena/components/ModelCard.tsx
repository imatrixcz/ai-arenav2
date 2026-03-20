import React, { useState } from 'react';
import { AIModel } from '../../../../types/aiarena';
import { MoreVertical, GripVertical, Heart, RefreshCw, Trash2 } from 'lucide-react';

interface ModelCardProps {
  model: AIModel;
  index: number;
  bestValues: Record<string, { value: number | null; modelIds: string[] }>;
  onRemove: (slug: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  index,
  bestValues,
  onRemove,
  onReorder,
  isDragging,
  onDragStart,
  onDragEnd,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  const formatPrice = (price: number): string => {
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}`;
  };

  const isBest = (key: string): boolean => {
    const best = bestValues[key];
    return best?.modelIds?.includes(model.id) ?? false;
  };

  const getModalityColor = (modality: string): { bg: string; text: string; border: string } => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      text: { bg: '#E3F2FD', text: '#007AFF', border: '#007AFF30' },
      image: { bg: '#E8F5E9', text: '#34C759', border: '#34C75930' },
      video: { bg: '#F3E5F5', text: '#AF52DE', border: '#AF52DE30' },
      file: { bg: '#FFF3E0', text: '#FF9500', border: '#FF950030' },
      audio: { bg: '#FFEBEE', text: '#FF3B30', border: '#FF3B3030' },
    };
    return colors[modality] || colors.text;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', index.toString());
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-80 bg-white rounded-xl border-2 transition-all duration-200
        ${isDragging ? 'opacity-50 rotate-2' : 'opacity-100'}
        ${isDragOver ? 'border-blue-400 scale-105' : 'border-gray-200'}
        hover:shadow-lg cursor-move
      `}
    >
      {/* Drag Handle & Menu */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          title="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    // Add to favorites
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  Add to Favorites
                </button>
                <button
                  onClick={() => {
                    // Replace model
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Replace
                </button>
                <button
                  onClick={() => {
                    onRemove(model.slug);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="p-5 pb-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          {model.provider}
        </div>
        <h3 className="text-lg font-bold text-gray-900 leading-tight pr-12">
          {model.name}
        </h3>
      </div>

      {/* Properties */}
      <div className="px-5 space-y-3">
        {/* Context Length */}
        <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${isBest('context_length') ? 'bg-green-50' : ''}`}>
          <span className="text-sm text-gray-600">Context Length</span>
          <span className={`text-sm font-semibold ${isBest('context_length') ? 'text-green-600' : 'text-gray-900'}`}>
            {formatNumber(model.context_length)}
          </span>
        </div>

        {/* Input Price */}
        <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${isBest('pricing_prompt') ? 'bg-green-50' : ''}`}>
          <span className="text-sm text-gray-600">Input Price (1M)</span>
          <span className={`text-sm font-semibold ${isBest('pricing_prompt') ? 'text-green-600' : 'text-gray-900'}`}>
            {formatPrice(model.pricing.prompt)}
          </span>
        </div>

        {/* Output Price */}
        <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${isBest('pricing_completion') ? 'bg-green-50' : ''}`}>
          <span className="text-sm text-gray-600">Output Price (1M)</span>
          <span className={`text-sm font-semibold ${isBest('pricing_completion') ? 'text-green-600' : 'text-gray-900'}`}>
            {formatPrice(model.pricing.completion)}
          </span>
        </div>

        {/* Max Output */}
        <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${isBest('max_output_tokens') ? 'bg-green-50' : ''}`}>
          <span className="text-sm text-gray-600">Max Output</span>
          <span className={`text-sm font-semibold ${isBest('max_output_tokens') ? 'text-green-600' : 'text-gray-900'}`}>
            {formatNumber(model.max_output_tokens)}
          </span>
        </div>

        {/* Moderated */}
        <div className="flex justify-between items-center py-2 px-3">
          <span className="text-sm text-gray-600">Moderated</span>
          <span className="text-sm font-semibold text-gray-900">
            {model.is_moderated ? 'Yes' : 'No'}
          </span>
        </div>

        {/* Modalities */}
        <div className="py-2">
          <span className="text-sm text-gray-600 block mb-2">Modality</span>
          <div className="flex flex-wrap gap-2">
            {model.modalities?.map((modality) => {
              const colors = getModalityColor(modality);
              const icons: Record<string, string> = {
                text: '📝',
                image: '🖼️',
                video: '🎬',
                file: '📎',
                audio: '🎵',
              };
              
              return (
                <span
                  key={modality}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <span>{icons[modality] || '📦'}</span>
                  <span className="capitalize">{modality}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer - ELO Rating */}
      <div className="mt-4 p-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Global ELO</span>
          <span className="text-sm font-bold text-gray-900">
            {Math.round(model.elo_ratings.global)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
