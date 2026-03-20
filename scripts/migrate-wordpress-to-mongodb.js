#!/usr/bin/env node
/**
 * WordPress to MongoDB Migration Script
 * 
 * This script exports data from WordPress MySQL database and prepares it
 * for import into MongoDB for AI Arena v2.
 * 
 * Usage: node migrate-wordpress-to-mongodb.js
 * Requires: mysql2, mongodb packages
 */

const mysql = require('mysql2/promise');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const MYSQL_CONFIG = {
  host: process.env.WP_DB_HOST || 'localhost',
  port: process.env.WP_DB_PORT || 3306,
  user: process.env.WP_DB_USER || 'wordpress',
  password: process.env.WP_DB_PASSWORD || 'wordpress',
  database: process.env.WP_DB_NAME || 'wordpress',
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiarena';
const OUTPUT_DIR = path.join(__dirname, 'migration-output');

// Helper: Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Format price
function formatPrice(value) {
  if (!value || value === '0') return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

// Helper: Parse modalities
function parseModalities(modalitiesData) {
  if (!modalitiesData) return ['text'];
  if (Array.isArray(modalitiesData)) return modalitiesData;
  if (typeof modalitiesData === 'string') {
    try {
      return JSON.parse(modalitiesData);
    } catch {
      return ['text'];
    }
  }
  return ['text'];
}

// Export AI Models from WordPress
async function exportAIModels(connection) {
  console.log('Exporting AI Models...');
  
  const [rows] = await connection.execute(`
    SELECT 
      p.ID as id,
      p.post_title as name,
      p.post_content as description,
      p.post_name as slug,
      p.post_date as created_at,
      p.post_modified as updated_at,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_global' THEN pm.meta_value END) as elo_global,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_code' THEN pm.meta_value END) as elo_code,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_image' THEN pm.meta_value END) as elo_image,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_video' THEN pm.meta_value END) as elo_video,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_audio' THEN pm.meta_value END) as elo_audio,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_text' THEN pm.meta_value END) as elo_text,
      MAX(CASE WHEN pm.meta_key = 'elo_rating_vision' THEN pm.meta_value END) as elo_vision,
      MAX(CASE WHEN pm.meta_key = 'context_length' THEN pm.meta_value END) as context_length,
      MAX(CASE WHEN pm.meta_key = 'max_prompt_tokens' THEN pm.meta_value END) as max_output_tokens,
      MAX(CASE WHEN pm.meta_key = 'pricing_prompt' THEN pm.meta_value END) as pricing_prompt,
      MAX(CASE WHEN pm.meta_key = 'pricing_completion' THEN pm.meta_value END) as pricing_completion,
      MAX(CASE WHEN pm.meta_key = 'pricing_image' THEN pm.meta_value END) as pricing_image,
      MAX(CASE WHEN pm.meta_key = 'modalities' THEN pm.meta_value END) as modalities,
      MAX(CASE WHEN pm.meta_key = 'architecture' THEN pm.meta_value END) as architecture,
      MAX(CASE WHEN pm.meta_key = 'openrouter_id' THEN pm.meta_value END) as openrouter_id,
      MAX(CASE WHEN pm.meta_key = 'is_moderated' THEN pm.meta_value END) as is_moderated,
      MAX(CASE WHEN pm.meta_key = 'release_date' THEN pm.meta_value END) as release_date,
      MAX(CASE WHEN pm.meta_key = 'model_version' THEN pm.meta_value END) as version
    FROM wp_posts p
    LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id
    WHERE p.post_type = 'ai_model' 
    AND p.post_status = 'publish'
    GROUP BY p.ID
  `);

  const models = rows.map(row => ({
    _id: new ObjectId(),
    slug: row.slug || generateSlug(row.name),
    openrouter_id: row.openrouter_id || null,
    name: row.name,
    description: row.description || '',
    provider: row.name.split(' ')[0] || 'Unknown', // Extract provider from name
    context_length: parseInt(row.context_length) || 0,
    max_output_tokens: parseInt(row.max_output_tokens) || 0,
    pricing: {
      prompt: formatPrice(row.pricing_prompt),
      completion: formatPrice(row.pricing_completion),
      image: formatPrice(row.pricing_image),
      tiers: [],
    },
    modalities: parseModalities(row.modalities),
    architecture: row.architecture || '',
    tokenizer: '',
    is_moderated: row.is_moderated === '1',
    is_active: true,
    release_date: row.release_date ? new Date(row.release_date) : null,
    version: row.version || '',
    elo_ratings: {
      global: parseFloat(row.elo_global) || 1200,
      code: parseFloat(row.elo_code) || 1200,
      image: parseFloat(row.elo_image) || 1200,
      video: parseFloat(row.elo_video) || 1200,
      audio: parseFloat(row.elo_audio) || 1200,
      text: parseFloat(row.elo_text) || 1200,
      vision: parseFloat(row.elo_vision) || 1200,
    },
    source: row.openrouter_id ? 'openrouter' : 'manual',
    last_synced_at: new Date(),
    manual_override: false,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    // Keep reference to old WordPress ID for relationships
    wp_id: row.id,
  }));

  // Create mapping for relationships
  const wpIdToMongoId = {};
  models.forEach(model => {
    wpIdToMongoId[model.wp_id] = model._id.toString();
  });

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'ai_models.json'),
    JSON.stringify(models, null, 2)
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'wp_id_mapping.json'),
    JSON.stringify(wpIdToMongoId, null, 2)
  );

  console.log(`✓ Exported ${models.length} AI models`);
  return { models, wpIdToMongoId };
}

// Export Benchmarks
async function exportBenchmarks(connection) {
  console.log('Exporting Benchmarks...');
  
  // First, let's check what tables exist
  const [tables] = await connection.execute(`
    SHOW TABLES LIKE '%benchmark%'
  `);
  
  console.log('Found benchmark tables:', tables);
  
  // For now, create default benchmarks based on categories
  const benchmarks = [
    {
      _id: new ObjectId(),
      slug: 'swe-bench-pro',
      name: 'SWE-Bench Pro',
      category: 'Coding',
      description: 'Software engineering tasks from GitHub issues',
      url: 'https://www.swebench.com/',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      _id: new ObjectId(),
      slug: 'human-eval',
      name: 'HumanEval',
      category: 'Coding',
      description: 'Function completion from docstrings',
      url: 'https://github.com/openai/human-eval',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      _id: new ObjectId(),
      slug: 'mmlu',
      name: 'MMLU',
      category: 'Knowledge',
      description: 'Massive Multitask Language Understanding',
      url: 'https://github.com/hendrycks/test',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      _id: new ObjectId(),
      slug: 'gsm8k',
      name: 'GSM8K',
      category: 'Math',
      description: 'Grade school math problems',
      url: 'https://github.com/openai/grade-school-math',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      _id: new ObjectId(),
      slug: 'hellaswag',
      name: 'HellaSwag',
      category: 'Reasoning',
      description: 'Commonsense reasoning',
      url: 'https://rowanzellers.com/hellaswag/',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'benchmarks.json'),
    JSON.stringify(benchmarks, null, 2)
  );

  console.log(`✓ Created ${benchmarks.length} default benchmarks`);
  return benchmarks;
}

// Export Prompts
async function exportPrompts(connection) {
  console.log('Exporting Prompts...');
  
  const [rows] = await connection.execute(`
    SELECT 
      p.ID as id,
      p.post_title as title,
      p.post_content as content,
      p.post_name as slug,
      p.post_date as created_at,
      p.post_modified as updated_at,
      MAX(CASE WHEN pm.meta_key = '_ai_arena_models' THEN pm.meta_value END) as models_data
    FROM wp_posts p
    LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id
    WHERE p.post_type = 'ai_prompt'
    AND p.post_status = 'publish'
    GROUP BY p.ID
    LIMIT 100
  `);

  const prompts = rows.map(row => ({
    _id: new ObjectId(),
    slug: row.slug || generateSlug(row.title),
    title: row.title,
    content: row.content || '',
    modality: 'text', // Default, would need to extract from taxonomies
    segment: '',
    outputs: [], // Would need to parse models_data
    is_active: true,
    created_by: null, // Would need to map user IDs
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  }));

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'prompts.json'),
    JSON.stringify(prompts, null, 2)
  );

  console.log(`✓ Exported ${prompts.length} prompts`);
  return prompts;
}

// Export Votes
async function exportVotes(connection, wpIdToMongoId) {
  console.log('Exporting Votes...');
  
  // Check if custom votes table exists
  try {
    const [rows] = await connection.execute(`
      SELECT * FROM wp_ai_votes LIMIT 1
    `);
    
    console.log('Found wp_ai_votes table structure');
    
    const [votes] = await connection.execute(`
      SELECT * FROM wp_ai_votes
    `);
    
    const transformedVotes = votes.map(vote => ({
      _id: new ObjectId(),
      prompt_id: wpIdToMongoId[vote.prompt_id] || null,
      user_id: new ObjectId(), // Would need user mapping
      model_a_id: wpIdToMongoId[vote.winner_model_id] || null,
      model_b_id: wpIdToMongoId[vote.loser_model_id] || null,
      winner_id: vote.vote_type === 'winner' ? wpIdToMongoId[vote.winner_model_id] : null,
      vote_type: vote.vote_type,
      modality: vote.modality || 'global',
      created_at: vote.created_at ? new Date(vote.created_at) : new Date(),
    })).filter(v => v.prompt_id && v.model_a_id); // Only valid votes

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'votes.json'),
      JSON.stringify(transformedVotes, null, 2)
    );

    console.log(`✓ Exported ${transformedVotes.length} votes`);
    return transformedVotes;
  } catch (error) {
    console.log('ℹ wp_ai_votes table not found or empty, skipping votes export');
    return [];
  }
}

// Import to MongoDB
async function importToMongoDB() {
  console.log('\nImporting to MongoDB...');
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  const db = client.db();
  
  // Clear existing data
  console.log('Clearing existing data...');
  await db.collection('ai_models').deleteMany({});
  await db.collection('benchmarks').deleteMany({});
  await db.collection('prompts').deleteMany({});
  await db.collection('votes').deleteMany({});
  await db.collection('model_benchmark_scores').deleteMany({});
  
  // Import models
  const modelsData = await fs.readFile(path.join(OUTPUT_DIR, 'ai_models.json'), 'utf8');
  const models = JSON.parse(modelsData);
  if (models.length > 0) {
    await db.collection('ai_models').insertMany(models);
    console.log(`✓ Imported ${models.length} models`);
  }
  
  // Import benchmarks
  const benchmarksData = await fs.readFile(path.join(OUTPUT_DIR, 'benchmarks.json'), 'utf8');
  const benchmarks = JSON.parse(benchmarksData);
  if (benchmarks.length > 0) {
    await db.collection('benchmarks').insertMany(benchmarks);
    console.log(`✓ Imported ${benchmarks.length} benchmarks`);
  }
  
  // Import prompts
  try {
    const promptsData = await fs.readFile(path.join(OUTPUT_DIR, 'prompts.json'), 'utf8');
    const prompts = JSON.parse(promptsData);
    if (prompts.length > 0) {
      await db.collection('prompts').insertMany(prompts);
      console.log(`✓ Imported ${prompts.length} prompts`);
    }
  } catch (error) {
    console.log('ℹ No prompts to import');
  }
  
  // Import votes
  try {
    const votesData = await fs.readFile(path.join(OUTPUT_DIR, 'votes.json'), 'utf8');
    const votes = JSON.parse(votesData);
    if (votes.length > 0) {
      await db.collection('votes').insertMany(votes);
      console.log(`✓ Imported ${votes.length} votes`);
    }
  } catch (error) {
    console.log('ℹ No votes to import');
  }
  
  // Create indexes
  console.log('Creating indexes...');
  await db.collection('ai_models').createIndex({ slug: 1 }, { unique: true });
  await db.collection('ai_models').createIndex({ openrouter_id: 1 }, { unique: true, sparse: true });
  await db.collection('ai_models').createIndex({ provider: 1 });
  await db.collection('ai_models').createIndex({ 'elo_ratings.global': -1 });
  await db.collection('benchmarks').createIndex({ slug: 1 }, { unique: true });
  await db.collection('prompts').createIndex({ slug: 1 }, { unique: true });
  await db.collection('votes').createIndex({ prompt_id: 1, user_id: 1 }, { unique: true });
  await db.collection('model_benchmark_scores').createIndex({ model_id: 1, benchmark_id: 1 }, { unique: true });
  
  await client.close();
  console.log('✓ Import complete');
}

// Main function
async function main() {
  console.log('AI Arena WordPress → MongoDB Migration\n');
  console.log('=====================================\n');
  
  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  let connection;
  try {
    // Connect to MySQL
    console.log('Connecting to WordPress MySQL...');
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✓ Connected to MySQL\n');
    
    // Export data
    const { models, wpIdToMongoId } = await exportAIModels(connection);
    await exportBenchmarks(connection);
    await exportPrompts(connection);
    await exportVotes(connection, wpIdToMongoId);
    
    await connection.end();
    console.log('\n✓ MySQL export complete');
    console.log(`✓ Files saved to: ${OUTPUT_DIR}\n`);
    
    // Import to MongoDB
    await importToMongoDB();
    
    console.log('\n=====================================');
    console.log('Migration completed successfully!');
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, exportAIModels, exportBenchmarks };
