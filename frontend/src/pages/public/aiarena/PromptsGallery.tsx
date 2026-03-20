import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { promptsApi } from '../../../api/aiarena';
import { Prompt } from '../../../types/aiarena';
import { Search, Grid, List, Filter, Image, Code, Video, Music, FileText } from 'lucide-react';

const modalityIcons: Record<string, React.ReactNode> = {
  code: <Code className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  text: <FileText className="w-5 h-5" />,
  vision: <Image className="w-5 h-5" />,
};

const modalityColors: Record<string, string> = {
  code: 'bg-blue-100 text-blue-700',
  image: 'bg-green-100 text-green-700',
  video: 'bg-purple-100 text-purple-700',
  audio: 'bg-red-100 text-red-700',
  text: 'bg-gray-100 text-gray-700',
  vision: 'bg-yellow-100 text-yellow-700',
};

const PromptsGallery: React.FC = () => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [modalities, setModalities] = useState<{ _id: string }[]>([]);
  const [segments, setSegments] = useState<{ _id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [search, selectedModality, selectedSegment, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [promptsRes, modalitiesRes, segmentsRes] = await Promise.all([
        promptsApi.getAll({
          modality: selectedModality || undefined,
          segment: selectedSegment || undefined,
          page,
          per_page: 24,
        }),
        promptsApi.getModalities(),
        promptsApi.getSegments(),
      ]);

      setPrompts(promptsRes.data.prompts);
      setTotalPages(promptsRes.data.pagination.pages);
      setModalities(modalitiesRes.data);
      setSegments(segmentsRes.data);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOutputPreview = (prompt: Prompt) => {
    if (!prompt.outputs || prompt.outputs.length === 0) {
      return (
        <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400">
          No outputs yet
        </div>
      );
    }

    const output = prompt.outputs[0];

    if (output.output_type === 'image' && output.media?.image_url) {
      return (
        <img
          src={output.media.image_url}
          alt={prompt.title}
          className="w-full h-48 object-cover rounded-lg"
        />
      );
    }

    if (output.output_type === 'video' && output.media?.video_url) {
      return (
        <video
          src={output.media.video_url}
          className="w-full h-48 object-cover rounded-lg"
          controls
        />
      );
    }

    if (output.output_type === 'audio' && output.media?.audio_url) {
      return (
        <div className="bg-gray-100 rounded-lg h-48 flex flex-col items-center justify-center p-4">
          {output.media.audio_cover_image && (
            <img
              src={output.media.audio_cover_image}
              alt="Cover"
              className="w-24 h-24 object-cover rounded-lg mb-3"
            />
          )}
          <audio src={output.media.audio_url} controls className="w-full" />
        </div>
      );
    }

    if (output.output_type === 'code' && output.code) {
      return (
        <div className="bg-gray-900 rounded-lg h-48 overflow-hidden">
          {output.code.preview_mode === 'live_iframe' ? (
            <iframe
              srcDoc={`
                <style>${output.code.css || ''}</style>
                ${output.code.html || ''}
                <script>${output.code.js || ''}</script>
              `}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title={prompt.title}
            />
          ) : output.code.video_url ? (
            <video
              src={output.code.video_url}
              className="w-full h-full object-cover"
              controls
              loop
            />
          ) : (
            <pre className="p-4 text-sm text-gray-300 overflow-auto h-full">
              <code>{output.code.html?.slice(0, 200)}...</code>
            </pre>
          )}
        </div>
      );
    }

    return (
      <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400">
        Preview not available
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Prompt Gallery</h1>
              <p className="text-sm text-gray-500 mt-1">
                Explore AI model outputs across different tasks
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Modality Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => setSelectedModality(null)}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${!selectedModality
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                `}
              >
                All Types
              </button>
              {modalities.map((mod) => (
                <button
                  key={mod._id}
                  onClick={() => setSelectedModality(mod._id)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                    ${selectedModality === mod._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {modalityIcons[mod._id]}
                  <span className="capitalize">{mod._id}</span>
                </button>
              ))}
            </div>

            {/* Segment Filter */}
            {segments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-sm text-gray-500 font-medium">Category:</span>
                <button
                  onClick={() => setSelectedSegment(null)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                    ${!selectedSegment
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  All
                </button>
                {segments.map((seg) => (
                  <button
                    key={seg._id}
                    onClick={() => setSelectedSegment(seg._id)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                      ${selectedSegment === seg._id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                    `}
                  >
                    {seg._id}
                  </button>
                ))}
              </div>
            )}

            {/* View Mode */}
            <div className="flex items-center justify-end gap-2">
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
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    onClick={() => navigate(`/prompts/${prompt.slug}`)}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {/* Preview */}
                    <div className="p-4 pb-0">
                      {renderOutputPreview(prompt)}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${modalityColors[prompt.modality]}`}>
                          {modalityIcons[prompt.modality]}
                          <span className="capitalize">{prompt.modality}</span>
                        </span>
                        {prompt.segment && (
                          <span className="text-xs text-gray-500">{prompt.segment}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{prompt.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{prompt.content}</p>
                      <div className="mt-3 text-xs text-gray-400">
                        {prompt.outputs?.length || 0} model outputs
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outputs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {prompts.map((prompt) => (
                      <tr
                        key={prompt.id}
                        onClick={() => navigate(`/prompts/${prompt.slug}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-6 py-4 w-32">
                          <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                            {renderOutputPreview({ ...prompt, outputs: prompt.outputs?.slice(0, 1) })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{prompt.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-2">{prompt.content}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${modalityColors[prompt.modality]}`}>
                            {modalityIcons[prompt.modality]}
                            <span className="capitalize">{prompt.modality}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{prompt.segment || '—'}</td>
                        <td className="px-6 py-4 text-gray-600">{prompt.outputs?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty State */}
            {prompts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No prompts found matching your criteria.</p>
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

export default PromptsGallery;
