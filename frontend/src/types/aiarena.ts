// AI Arena Types

export interface AIModel {
  id: string;
  slug: string;
  openrouter_id: string;
  name: string;
  description: string;
  provider: string;
  context_length: number;
  max_output_tokens: number;
  pricing: {
    prompt: number;
    completion: number;
    image: number;
    tiers?: Array<{
      threshold: number;
      prompt_price: number;
      completion_price: number;
      label: string;
    }>;
  };
  modalities: string[];
  architecture: string;
  tokenizer: string;
  is_moderated: boolean;
  is_active: boolean;
  release_date: string;
  version: string;
  elo_ratings: {
    global: number;
    code: number;
    image: number;
    video: number;
    audio: number;
    text: number;
    vision: number;
  };
  source: 'openrouter' | 'manual';
  last_synced_at: string;
  manual_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface Benchmark {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BenchmarkScore {
  id: string;
  model_id: string;
  benchmark_id: string;
  score: number;
  score_formatted: string;
  raw_value?: string;
  source: 'manual' | 'huggingface' | 'openrouter';
  url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  model_name?: string;
  model_slug?: string;
  benchmark_name?: string;
  benchmark_category?: string;
}

export interface PromptOutput {
  model_id: string;
  output_type: 'code' | 'image' | 'video' | 'audio';
  code?: {
    html: string;
    css: string;
    js: string;
    preview_mode: 'live_iframe' | 'video_loop';
    video_url?: string;
  };
  media?: {
    image_url?: string;
    video_url?: string;
    audio_url?: string;
    audio_cover_image?: string;
  };
  created_at: string;
}

export interface Prompt {
  id: string;
  slug: string;
  title: string;
  content: string;
  modality: 'code' | 'image' | 'video' | 'audio' | 'text' | 'vision';
  segment?: string;
  outputs: PromptOutput[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  prompt_id: string;
  user_id: string;
  model_a_id: string;
  model_b_id: string;
  winner_id?: string;
  vote_type: 'winner' | 'both_good' | 'both_bad' | 'tie';
  modality: string;
  created_at: string;
}

export interface LeaderboardEntry extends AIModel {
  rank: number;
  score: number;
}

export interface BattlePair {
  prompt: {
    id: string;
    title: string;
    content: string;
    modality: string;
  };
  model_a: {
    id: string;
    anonymous: string;
    output: PromptOutput;
  };
  model_b: {
    id: string;
    anonymous: string;
    output: PromptOutput;
  };
}

export interface Provider {
  _id: string;
  count: number;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface ModelsResponse {
  models: AIModel[];
  pagination: Pagination;
}

export interface LeaderboardResponse {
  modality: string;
  entries: LeaderboardEntry[];
  pagination: Pagination;
}
