const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../services/user-service/.env') });
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(dbConfig);

async function createMissingTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating missing tables...\n');
    
    // 1. Create developer_favorites table
    console.log('1️⃣ Creating developer_favorites table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        developer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, developer_id)
      );
    `);
    console.log('   ✅ developer_favorites table created');
    
    // 2. Create developer_saves table
    console.log('\n2️⃣ Creating developer_saves table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_saves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        developer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, developer_id)
      );
    `);
    console.log('   ✅ developer_saves table created');
    
    // 3. Create developer_applications table
    console.log('\n3️⃣ Creating developer_applications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_applications (
        id SERIAL PRIMARY KEY,
        project_owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        developer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        message TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(project_owner_id, developer_id, project_id)
      );
    `);
    console.log('   ✅ developer_applications table created');
    
    // Create indexes for better performance
    console.log('\n4️⃣ Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_developer_favorites_user_id ON developer_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_developer_favorites_developer_id ON developer_favorites(developer_id);
      CREATE INDEX IF NOT EXISTS idx_developer_saves_user_id ON developer_saves(user_id);
      CREATE INDEX IF NOT EXISTS idx_developer_saves_developer_id ON developer_saves(developer_id);
      CREATE INDEX IF NOT EXISTS idx_developer_applications_project_owner_id ON developer_applications(project_owner_id);
      CREATE INDEX IF NOT EXISTS idx_developer_applications_developer_id ON developer_applications(developer_id);
      CREATE INDEX IF NOT EXISTS idx_developer_applications_project_id ON developer_applications(project_id);
    `);
    console.log('   ✅ Indexes created');
    
    console.log('\n🎉 All missing tables created successfully!');
    
  } catch (error) {
    console.error('\n❌ Error creating tables:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createMissingTables().catch(console.error);

