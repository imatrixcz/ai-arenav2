import api from './client';
import { 
  AIModel, 
  Benchmark, 
  BenchmarkScore, 
  ModelsResponse, 
  LeaderboardResponse, 
  BattlePair,
  Prompt,
  Vote
} from '../types/aiarena';

// Models API
export const modelsApi = {
  getAll: (params?: { 
    provider?: string; 
    search?: string; 
    page?: number; 
    per_page?: number;
  }) => 
    api.get<ModelsResponse>('/models', { params }),
  
  getBySlug: (slug: string) => 
    api.get<{ model: AIModel; scores: BenchmarkScore[] }>(`/models/${slug}`),
  
  compare: (slugs: string[]) => 
    api.get<{ models: AIModel[]; benchmarks: any[] }>('/models/compare', { 
      params: { slugs } 
    }),
  
  getProviders: () => 
    api.get<{ _id: string; count: number }[]>('/providers'),
};

// Benchmarks API
export const benchmarksApi = {
  getAll: (category?: string) => 
    api.get<Benchmark[]>('/benchmarks', { params: { category } }),
  
  getCategories: () => 
    api.get<{ _id: string }[]>('/benchmarks/categories'),
  
  getScores: (slug: string) => 
    api.get<{ benchmark: Benchmark; scores: any[] }>(`/benchmarks/${slug}/scores`),
};

// Leaderboard API
export const leaderboardApi = {
  get: (modality?: string, page?: number, perPage?: number) => 
    api.get<LeaderboardResponse>('/leaderboard', { 
      params: { modality, page, per_page: perPage } 
    }),
};

// Battle API
export const battleApi = {
  getPair: (modality?: string) => 
    api.get<BattlePair>('/battle-pair', { params: { modality } }),
  
  submitVote: (data: {
    prompt_id: string;
    model_a_id: string;
    model_b_id: string;
    winner_id?: string;
    vote_type: 'winner' | 'both_good' | 'both_bad' | 'tie';
  }) => api.post<Vote>('/vote', data),
};

// Prompts API
export const promptsApi = {
  getAll: (params?: { 
    modality?: string; 
    segment?: string; 
    page?: number; 
    per_page?: number;
  }) => api.get<{ prompts: Prompt[]; pagination: any }>('/prompts', { params }),
  
  getBySlug: (slug: string) => api.get<Prompt>(`/prompts/${slug}`),
  
  getModalities: () => api.get<{ _id: string }[]>('/prompts/modalities'),
  
  getSegments: () => api.get<{ _id: string }[]>('/prompts/segments'),
};

// Admin API
export const adminApi = {
  // Models
  createModel: (data: Partial<AIModel>) => api.post('/ai-models', data),
  updateModel: (id: string, data: Partial<AIModel>) => api.put(`/ai-models/${id}`, data),
  deleteModel: (id: string) => api.delete(`/ai-models/${id}`),
  
  // Benchmarks
  createBenchmark: (data: Partial<Benchmark>) => api.post('/benchmarks', data),
  updateBenchmark: (id: string, data: Partial<Benchmark>) => api.put(`/benchmarks/${id}`, data),
  deleteBenchmark: (id: string) => api.delete(`/benchmarks/${id}`),
  
  // Scores
  createScore: (data: Partial<BenchmarkScore>) => api.post('/scores', data),
  updateScore: (id: string, data: Partial<BenchmarkScore>) => api.put(`/scores/${id}`, data),
  deleteScore: (id: string) => api.delete(`/scores/${id}`),
  
  // Prompts
  createPrompt: (data: Partial<Prompt>) => api.post('/prompts', data),
  updatePrompt: (id: string, data: Partial<Prompt>) => api.put(`/prompts/${id}`, data),
  deletePrompt: (id: string) => api.delete(`/prompts/${id}`),
  
  // ELO & Sync
  recalculateELO: () => api.post('/elo/recalculate'),
  syncOpenRouter: () => api.post('/sync/openrouter'),
  getSyncLogs: () => api.get('/sync/logs'),
  getSyncStatus: () => api.get('/sync/status'),
};
