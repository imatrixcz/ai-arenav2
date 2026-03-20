import React, { useState, useEffect } from 'react';
import { battleApi } from '../../../api/aiarena';
import { BattlePair } from '../../../types/aiarena';
import { Swords, ThumbsUp, ThumbsDown, Scale, AlertCircle } from 'lucide-react';

const Battle: React.FC = () => {
  const [battlePair, setBattlePair] = useState<BattlePair | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBattlePair();
  }, []);

  const loadBattlePair = async () => {
    setLoading(true);
    setRevealed(false);
    setError(null);
    try {
      const response = await battleApi.getPair();
      setBattlePair(response.data);
    } catch (err) {
      setError('Failed to load battle pair. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (winner: 'a' | 'b' | 'tie' | 'both_good' | 'both_bad') => {
    if (!battlePair || voting) return;

    setVoting(true);
    try {
      let voteData: any = {
        prompt_id: battlePair.prompt.id,
        model_a_id: battlePair.model_a.id,
        model_b_id: battlePair.model_b.id,
      };

      switch (winner) {
        case 'a':
          voteData = { ...voteData, winner_id: battlePair.model_a.id, vote_type: 'winner' };
          break;
        case 'b':
          voteData = { ...voteData, winner_id: battlePair.model_b.id, vote_type: 'winner' };
          break;
        case 'tie':
          voteData = { ...voteData, vote_type: 'tie' };
          break;
        case 'both_good':
          voteData = { ...voteData, vote_type: 'both_good' };
          break;
        case 'both_bad':
          voteData = { ...voteData, vote_type: 'both_bad' };
          break;
      }

      await battleApi.submitVote(voteData);
      setRevealed(true);
    } catch (err) {
      setError('Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const renderOutput = (output: any, anonymous: string) => {
    if (!output) return <div className="text-gray-500">No output available</div>;

    if (output.output_type === 'code' && output.code) {
      return (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          {output.code.preview_mode === 'live_iframe' ? (
            <iframe
              srcDoc={`
                <style>${output.code.css || ''}</style>
                ${output.code.html || ''}
                <script>${output.code.js || ''}</script>
              `}
              className="w-full h-64 border-0"
              sandbox="allow-scripts"
              title={`${anonymous} output`}
            />
          ) : output.code.video_url ? (
            <video
              src={output.code.video_url}
              className="w-full h-64 object-cover"
              controls
              loop
            />
          ) : (
            <pre className="p-4 text-sm text-gray-300 overflow-auto h-64">
              <code>{output.code.html}</code>
            </pre>
          )}
        </div>
      );
    }

    if (output.output_type === 'image' && output.media?.image_url) {
      return (
        <img
          src={output.media.image_url}
          alt={`${anonymous} output`}
          className="w-full h-64 object-cover rounded-lg"
        />
      );
    }

    if (output.output_type === 'video' && output.media?.video_url) {
      return (
        <video
          src={output.media.video_url}
          className="w-full h-64 object-cover rounded-lg"
          controls
        />
      );
    }

    if (output.output_type === 'audio' && output.media?.audio_url) {
      return (
        <div className="bg-gray-100 rounded-lg p-4">
          {output.media.audio_cover_image && (
            <img
              src={output.media.audio_cover_image}
              alt="Cover"
              className="w-full h-32 object-cover rounded-lg mb-4"
            />
          )}
          <audio src={output.media.audio_url} controls className="w-full" />
        </div>
      );
    }

    return <div className="text-gray-500">Unsupported output type</div>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadBattlePair}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!battlePair) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          No battle pairs available at the moment.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Swords className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Battle</h1>
                <p className="text-sm text-gray-500">Vote for the better output</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Modality: <span className="font-medium capitalize">{battlePair.prompt.modality}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{battlePair.prompt.title}</h2>
          <p className="text-gray-600">{battlePair.prompt.content}</p>
        </div>
      </div>

      {/* Battle Arena */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model A */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{battlePair.model_a.anonymous}</h3>
            </div>
            <div className="p-4">
              {renderOutput(battlePair.model_a.output, battlePair.model_a.anonymous)}
            </div>
            {!revealed && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => handleVote('a')}
                  disabled={voting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <ThumbsUp className="w-5 h-5" />
                  Vote for Model A
                </button>
              </div>
            )}
            {revealed && (
              <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-600">
                Model ID: {battlePair.model_a.id}
              </div>
            )}
          </div>

          {/* Model B */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{battlePair.model_b.anonymous}</h3>
            </div>
            <div className="p-4">
              {renderOutput(battlePair.model_b.output, battlePair.model_b.anonymous)}
            </div>
            {!revealed && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => handleVote('b')}
                  disabled={voting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <ThumbsUp className="w-5 h-5" />
                  Vote for Model B
                </button>
              </div>
            )}
            {revealed && (
              <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-600">
                Model ID: {battlePair.model_b.id}
              </div>
            )}
          </div>
        </div>

        {/* Other Options */}
        {!revealed && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => handleVote('tie')}
              disabled={voting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Scale className="w-4 h-4" />
              Tie
            </button>
            <button
              onClick={() => handleVote('both_good')}
              disabled={voting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ThumbsUp className="w-4 h-4" />
              Both Good
            </button>
            <button
              onClick={() => handleVote('both_bad')}
              disabled={voting}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ThumbsDown className="w-4 h-4" />
              Both Bad
            </button>
          </div>
        )}

        {/* Next Battle Button */}
        {revealed && (
          <div className="mt-8 text-center">
            <button
              onClick={loadBattlePair}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Swords className="w-5 h-5" />
              Next Battle
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Battle;
