// MongoDB Seed Data for AI Arena v2
// Run this in MongoDB shell or MongoDB Compass

use('aiarena');

// Clear existing data
db.ai_models.deleteMany({});
db.benchmarks.deleteMany({});
db.model_benchmark_scores.deleteMany({});
db.prompts.deleteMany({});
db.votes.deleteMany({});
db.elo_history.deleteMany({});

// Sample AI Models (10 models for testing)
const models = [
  {
    _id: ObjectId(),
    slug: 'gpt-4o',
    openrouter_id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI\'s flagship multimodal model',
    provider: 'OpenAI',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 2.50,
      completion: 10.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image'],
    architecture: 'transformer',
    tokenizer: 'GPT-4',
    is_moderated: true,
    is_active: true,
    release_date: new Date('2024-05-13'),
    version: '2024-05-13',
    elo_ratings: {
      global: 1250,
      code: 1280,
      image: 1220,
      video: 1200,
      audio: 1200,
      text: 1270,
      vision: 1240
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'claude-3-5-sonnet',
    openrouter_id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic\'s most intelligent model',
    provider: 'Anthropic',
    context_length: 200000,
    max_output_tokens: 8192,
    pricing: {
      prompt: 3.00,
      completion: 15.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image'],
    architecture: 'transformer',
    tokenizer: 'Claude',
    is_moderated: true,
    is_active: true,
    release_date: new Date('2024-06-20'),
    version: '2024-06-20',
    elo_ratings: {
      global: 1280,
      code: 1320,
      image: 1250,
      video: 1200,
      audio: 1200,
      text: 1290,
      vision: 1260
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'gemini-1-5-pro',
    openrouter_id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Google\'s multimodal model with long context',
    provider: 'Google',
    context_length: 2000000,
    max_output_tokens: 8192,
    pricing: {
      prompt: 3.50,
      completion: 10.50,
      image: 0.0,
      tiers: [
        { threshold: 128000, prompt_price: 3.50, completion_price: 10.50, label: 'Up to 128K' },
        { threshold: 2000000, prompt_price: 7.00, completion_price: 21.00, label: '128K to 2M' }
      ]
    },
    modalities: ['text', 'image', 'video', 'audio'],
    architecture: 'transformer',
    tokenizer: 'Gemini',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-02-15'),
    version: '001',
    elo_ratings: {
      global: 1240,
      code: 1260,
      image: 1280,
      video: 1300,
      audio: 1250,
      text: 1240,
      vision: 1270
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'grok-2',
    openrouter_id: 'x-ai/grok-2',
    name: 'Grok 2',
    description: 'xAI\'s conversational AI',
    provider: 'xAI',
    context_length: 131072,
    max_output_tokens: 4096,
    pricing: {
      prompt: 5.00,
      completion: 15.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image'],
    architecture: 'transformer',
    tokenizer: 'Grok',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-08-13'),
    version: '2.0',
    elo_ratings: {
      global: 1220,
      code: 1240,
      image: 1210,
      video: 1200,
      audio: 1200,
      text: 1230,
      vision: 1220
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'llama-3-1-405b',
    openrouter_id: 'meta/llama-3.1-405b',
    name: 'Llama 3.1 405B',
    description: 'Meta\'s largest open model',
    provider: 'Meta',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 2.00,
      completion: 2.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text'],
    architecture: 'transformer',
    tokenizer: 'Llama',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-07-23'),
    version: '3.1',
    elo_ratings: {
      global: 1210,
      code: 1230,
      image: 1200,
      video: 1200,
      audio: 1200,
      text: 1220,
      vision: 1200
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'mistral-large-2',
    openrouter_id: 'mistral/mistral-large-2',
    name: 'Mistral Large 2',
    description: 'Mistral\'s flagship model',
    provider: 'Mistral AI',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 2.00,
      completion: 6.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text'],
    architecture: 'transformer',
    tokenizer: 'Mistral',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-07-24'),
    version: '2.0',
    elo_ratings: {
      global: 1200,
      code: 1220,
      image: 1200,
      video: 1200,
      audio: 1200,
      text: 1210,
      vision: 1200
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'gpt-4o-mini',
    openrouter_id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'OpenAI\'s affordable model',
    provider: 'OpenAI',
    context_length: 128000,
    max_output_tokens: 16384,
    pricing: {
      prompt: 0.15,
      completion: 0.60,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image'],
    architecture: 'transformer',
    tokenizer: 'GPT-4',
    is_moderated: true,
    is_active: true,
    release_date: new Date('2024-07-18'),
    version: '2024-07-18',
    elo_ratings: {
      global: 1180,
      code: 1200,
      image: 1170,
      video: 1200,
      audio: 1200,
      text: 1190,
      vision: 1180
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'claude-3-haiku',
    openrouter_id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Anthropic\'s fastest model',
    provider: 'Anthropic',
    context_length: 200000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 0.25,
      completion: 1.25,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image'],
    architecture: 'transformer',
    tokenizer: 'Claude',
    is_moderated: true,
    is_active: true,
    release_date: new Date('2024-03-07'),
    version: '3.0',
    elo_ratings: {
      global: 1150,
      code: 1170,
      image: 1140,
      video: 1200,
      audio: 1200,
      text: 1160,
      vision: 1150
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'gemini-1-5-flash',
    openrouter_id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Google\'s fast and affordable model',
    provider: 'Google',
    context_length: 1000000,
    max_output_tokens: 8192,
    pricing: {
      prompt: 0.35,
      completion: 0.70,
      image: 0.0,
      tiers: []
    },
    modalities: ['text', 'image', 'video', 'audio'],
    architecture: 'transformer',
    tokenizer: 'Gemini',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-05-24'),
    version: '001',
    elo_ratings: {
      global: 1170,
      code: 1180,
      image: 1190,
      video: 1200,
      audio: 1180,
      text: 1170,
      vision: 1180
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'command-r-plus',
    openrouter_id: 'cohere/command-r-plus',
    name: 'Command R+',
    description: 'Cohere\'s most powerful model',
    provider: 'Cohere',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      prompt: 3.00,
      completion: 15.00,
      image: 0.0,
      tiers: []
    },
    modalities: ['text'],
    architecture: 'transformer',
    tokenizer: 'Cohere',
    is_moderated: false,
    is_active: true,
    release_date: new Date('2024-04-04'),
    version: '08-2024',
    elo_ratings: {
      global: 1160,
      code: 1180,
      image: 1200,
      video: 1200,
      audio: 1200,
      text: 1170,
      vision: 1200
    },
    source: 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: new Date(),
    updated_at: new Date()
  }
];

db.ai_models.insertMany(models);

// Sample Benchmarks
const benchmarks = [
  {
    _id: ObjectId(),
    slug: 'swe-bench-pro',
    name: 'SWE-Bench Pro',
    category: 'Coding',
    description: 'Software engineering tasks from GitHub issues',
    url: 'https://www.swebench.com/',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'human-eval',
    name: 'HumanEval',
    category: 'Coding',
    description: 'Function completion from docstrings',
    url: 'https://github.com/openai/human-eval',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'mmlu',
    name: 'MMLU',
    category: 'Knowledge',
    description: 'Massive Multitask Language Understanding',
    url: 'https://github.com/hendrycks/test',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'gsm8k',
    name: 'GSM8K',
    category: 'Math',
    description: 'Grade school math problems',
    url: 'https://github.com/openai/grade-school-math',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'hellaswag',
    name: 'HellaSwag',
    category: 'Reasoning',
    description: 'Commonsense reasoning',
    url: 'https://rowanzellers.com/hellaswag/',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

db.benchmarks.insertMany(benchmarks);

// Sample Benchmark Scores
const scores = [];
const modelIds = models.map(m => m._id);
const benchmarkIds = benchmarks.map(b => b._id);

// Generate random scores for each model-benchmark combination
modelIds.forEach(modelId => {
  benchmarkIds.forEach(benchmarkId => {
    const score = Math.random() * 40 + 60; // Random score between 60-100
    scores.push({
      _id: ObjectId(),
      model_id: modelId,
      benchmark_id: benchmarkId,
      score: score,
      score_formatted: score.toFixed(1) + '%',
      source: 'manual',
      created_at: new Date(),
      updated_at: new Date()
    });
  });
});

db.model_benchmark_scores.insertMany(scores);

// Sample Prompts
const prompts = [
  {
    _id: ObjectId(),
    slug: 'create-react-button',
    title: 'Create a React Button Component',
    content: 'Create a beautiful, animated button component in React with hover effects and click animations.',
    modality: 'code',
    segment: 'UI Components',
    outputs: [],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'generate-portrait',
    title: 'Generate a Portrait',
    content: 'Create a realistic portrait of a young professional in an office setting.',
    modality: 'image',
    segment: 'Portraits',
    outputs: [],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    _id: ObjectId(),
    slug: 'explain-quantum',
    title: 'Explain Quantum Computing',
    content: 'Explain quantum computing to a 10-year-old in simple terms.',
    modality: 'text',
    segment: 'Education',
    outputs: [],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

db.prompts.insertMany(prompts);

print('Seed data inserted successfully!');
print(`- ${models.length} AI Models`);
print(`- ${benchmarks.length} Benchmarks`);
print(`- ${scores.length} Benchmark Scores`);
print(`- ${prompts.length} Prompts`);
