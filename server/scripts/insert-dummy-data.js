const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../services/user-service/.env') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(dbConfig);

// User emails
const DEVELOPER_EMAIL = 'raorajan9576@gmail.com';
const PROJECT_OWNER_EMAIL = 'shrikishunr7@gmail.com';
const ADMIN_EMAIL = 'nexthire6@gmail.com';
const DEFAULT_PASSWORD = 'Test123!@#'; // Will be hashed

async function insertDummyData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting dummy data insertion...\n');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    
    // 1. Create/Update Developer User
    console.log('1️⃣ Creating/Updating Developer User...');
    let developerResult = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [DEVELOPER_EMAIL]
    );
    
    let developerId;
    if (developerResult.rows.length > 0) {
      developerId = developerResult.rows[0].id;
      console.log(`   ✅ Developer exists with ID: ${developerId}`);
      // Update developer
      await client.query(
        `UPDATE users SET 
          name = $1, 
          password = $2, 
          role = $3,
          roles = $4,
          bio = $5,
          skills = $6,
          experience = $7,
          location = $8,
          availability = $9,
          github_url = $10,
          linkedin_url = $11,
          portfolio_url = $12,
          is_email_verified = $13,
          xp = $14,
          level = $15,
          updated_at = NOW()
        WHERE id = $16`,
        [
          'Rao Rajan',
          hashedPassword,
          'developer',
          JSON.stringify(['developer']),
          'Full-stack developer with expertise in React, Node.js, and cloud technologies. Passionate about building scalable web applications.',
          JSON.stringify({
            'React': 'Expert',
            'Node.js': 'Advanced',
            'TypeScript': 'Advanced',
            'PostgreSQL': 'Advanced',
            'AWS': 'Intermediate',
            'Docker': 'Intermediate'
          }),
          '5 Years',
          'Remote',
          'full-time',
          'https://github.com/raorajan',
          'https://linkedin.com/in/raorajan',
          'https://raorajan.dev',
          true,
          2500,
          5,
          developerId
        ]
      );
    } else {
      // Create developer
      const devResult = await client.query(
        `INSERT INTO users (
          name, email, password, role, roles, bio, skills, experience, 
          location, availability, github_url, linkedin_url, portfolio_url, 
          is_email_verified, xp, level, domain_preferences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id`,
        [
          'Rao Rajan',
          DEVELOPER_EMAIL,
          hashedPassword,
          'developer',
          JSON.stringify(['developer']),
          'Full-stack developer with expertise in React, Node.js, and cloud technologies. Passionate about building scalable web applications.',
          JSON.stringify({
            'React': 'Expert',
            'Node.js': 'Advanced',
            'TypeScript': 'Advanced',
            'PostgreSQL': 'Advanced',
            'AWS': 'Intermediate',
            'Docker': 'Intermediate'
          }),
          '5 Years',
          'Remote',
          'full-time',
          'https://github.com/raorajan',
          'https://linkedin.com/in/raorajan',
          'https://raorajan.dev',
          true,
          2500,
          5,
          'Web Development, Full Stack'
        ]
      );
      developerId = devResult.rows[0].id;
      console.log(`   ✅ Developer created with ID: ${developerId}`);
    }
    
    // Roles are stored in the users.roles JSON column, already set above
    
    // 2. Create/Update Project Owner User
    console.log('\n2️⃣ Creating/Updating Project Owner User...');
    let projectOwnerResult = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [PROJECT_OWNER_EMAIL]
    );
    
    let projectOwnerId;
    if (projectOwnerResult.rows.length > 0) {
      projectOwnerId = projectOwnerResult.rows[0].id;
      console.log(`   ✅ Project Owner exists with ID: ${projectOwnerId}`);
      // Update project owner
      await client.query(
        `UPDATE users SET 
          name = $1, 
          password = $2, 
          role = $3,
          roles = $4,
          bio = $5,
          location = $6,
          availability = $7,
          is_email_verified = $8,
          updated_at = NOW()
        WHERE id = $9`,
        [
          'Shri Kishun',
          hashedPassword,
          'project-owner',
          JSON.stringify(['project-owner']),
          'Company: TechStart Inc.\nWebsite: https://techstart.com\nBusiness Type: SaaS',
          'San Francisco, CA',
          'full-time',
          true,
          projectOwnerId
        ]
      );
    } else {
      // Create project owner
      const poResult = await client.query(
        `INSERT INTO users (
          name, email, password, role, roles, bio, location, 
          availability, is_email_verified, domain_preferences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          'Shri Kishun',
          PROJECT_OWNER_EMAIL,
          hashedPassword,
          'project-owner',
          JSON.stringify(['project-owner']),
          'Company: TechStart Inc.\nWebsite: https://techstart.com\nBusiness Type: SaaS',
          'San Francisco, CA',
          'full-time',
          true,
          'TechStart Inc.'
        ]
      );
      projectOwnerId = poResult.rows[0].id;
      console.log(`   ✅ Project Owner created with ID: ${projectOwnerId}`);
    }
    
    // Roles are stored in the users.roles JSON column, already set above
    
    // 3. Create/Update Admin User
    console.log('\n3️⃣ Creating/Updating Admin User...');
    let adminResult = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [ADMIN_EMAIL]
    );
    
    let adminId;
    if (adminResult.rows.length > 0) {
      adminId = adminResult.rows[0].id;
      console.log(`   ✅ Admin exists with ID: ${adminId}`);
      // Update admin
      await client.query(
        `UPDATE users SET 
          name = $1, 
          password = $2, 
          role = $3,
          roles = $4,
          is_email_verified = $5,
          updated_at = NOW()
        WHERE id = $6`,
        [
          'Next Hire Admin',
          hashedPassword,
          'admin',
          JSON.stringify(['admin']),
          true,
          adminId
        ]
      );
    } else {
      // Create admin
      const adminRes = await client.query(
        `INSERT INTO users (
          name, email, password, role, roles, is_email_verified, domain_preferences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          'Next Hire Admin',
          ADMIN_EMAIL,
          hashedPassword,
          'admin',
          JSON.stringify(['admin']),
          true,
          'N/A'
        ]
      );
      adminId = adminRes.rows[0].id;
      console.log(`   ✅ Admin created with ID: ${adminId}`);
    }
    
    // Roles are stored in the users.roles JSON column, already set above
    
    // 4. Create Projects for Project Owner
    console.log('\n4️⃣ Creating Projects...');
    const projects = [
      {
        title: 'E-commerce Platform Development',
        description: 'Looking for an experienced full-stack developer to build a modern e-commerce platform with React and Node.js. The project includes user authentication, product catalog, shopping cart, payment integration, and admin dashboard.',
        role_needed: 'Full Stack Developer',
        status: 'active',
        priority: 'high',
        category: 'Web Development',
        experience_level: 'senior',
        budget_min: 5000,
        budget_max: 10000,
        currency: 'USD',
        is_remote: true,
        location: 'Remote',
        duration: '3-6 months',
        requirements: '5+ years experience with React, Node.js, PostgreSQL. Experience with payment gateways and e-commerce platforms.',
        benefits: 'Competitive salary, flexible hours, remote work, opportunity to work on a growing product'
      },
      {
        title: 'Mobile App for Task Management',
        description: 'Need a React Native developer to build a cross-platform mobile app for task and project management. Features include task creation, team collaboration, notifications, and real-time updates.',
        role_needed: 'Mobile Developer',
        status: 'active',
        priority: 'medium',
        category: 'Mobile Development',
        experience_level: 'mid',
        budget_min: 3000,
        budget_max: 6000,
        currency: 'USD',
        is_remote: true,
        location: 'Remote',
        duration: '2-4 months',
        requirements: '3+ years React Native experience, knowledge of state management, API integration',
        benefits: 'Remote work, flexible schedule, competitive pay'
      },
      {
        title: 'AI-Powered Analytics Dashboard',
        description: 'Seeking a developer with AI/ML experience to build an analytics dashboard with predictive features. The dashboard should analyze user behavior and provide insights using machine learning models.',
        role_needed: 'AI/ML Developer',
        status: 'upcoming',
        priority: 'high',
        category: 'AI Development',
        experience_level: 'senior',
        budget_min: 8000,
        budget_max: 15000,
        currency: 'USD',
        is_remote: true,
        location: 'Remote',
        duration: '4-6 months',
        requirements: 'Experience with Python, TensorFlow/PyTorch, data visualization, REST APIs',
        benefits: 'High compensation, cutting-edge technology, remote work'
      }
    ];
    
    const projectIds = [];
    for (const project of projects) {
      const projResult = await client.query(
        `INSERT INTO projects (
          owner_id, title, description, role_needed, status, priority, category,
          experience_level, budget_min, budget_max, currency, is_remote, location,
          duration, requirements, benefits, visibility, payment_terms, work_arrangement
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [
          projectOwnerId,
          project.title,
          project.description,
          project.role_needed,
          project.status,
          project.priority,
          project.category,
          project.experience_level,
          project.budget_min,
          project.budget_max,
          project.currency,
          project.is_remote,
          project.location,
          project.duration,
          project.requirements,
          project.benefits,
          'public',
          'fixed',
          'remote'
        ]
      );
      if (projResult.rows.length > 0) {
        projectIds.push(projResult.rows[0].id);
        console.log(`   ✅ Created project: ${project.title} (ID: ${projResult.rows[0].id})`);
      } else {
        // Project might already exist, try to get it
        const existing = await client.query(
          `SELECT id FROM projects WHERE owner_id = $1 AND title = $2 LIMIT 1`,
          [projectOwnerId, project.title]
        );
        if (existing.rows.length > 0) {
          projectIds.push(existing.rows[0].id);
          console.log(`   ℹ️  Project already exists: ${project.title} (ID: ${existing.rows[0].id})`);
        }
      }
    }
    
    // 5. Create Developer Favorites (Project Owner favorites Developer)
    console.log('\n5️⃣ Creating Developer Favorites...');
    try {
      await client.query(
        `INSERT INTO developer_favorites (user_id, developer_id) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING`,
        [projectOwnerId, developerId]
      );
      console.log(`   ✅ Project Owner favorited Developer`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log(`   ⚠️  developer_favorites table does not exist, skipping...`);
      } else {
        throw error;
      }
    }
    
    // 6. Create Developer Saves
    console.log('\n6️⃣ Creating Developer Saves...');
    try {
      await client.query(
        `INSERT INTO developer_saves (user_id, developer_id) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING`,
        [projectOwnerId, developerId]
      );
      console.log(`   ✅ Project Owner saved Developer`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log(`   ⚠️  developer_saves table does not exist, skipping...`);
      } else {
        throw error;
      }
    }
    
    // 7. Create Developer Applications (Project Owner applies to Developer)
    console.log('\n7️⃣ Creating Developer Applications...');
    try {
      if (projectIds.length > 0) {
        await client.query(
          `INSERT INTO developer_applications (
            project_owner_id, developer_id, project_id, message, status
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING`,
          [
            projectOwnerId,
            developerId,
            projectIds[0],
            'We are impressed with your portfolio and would like to discuss the E-commerce Platform Development project with you.',
            'pending'
          ]
        );
        console.log(`   ✅ Created application from Project Owner to Developer`);
      }
    } catch (error) {
      if (error.code === '42P01') {
        console.log(`   ⚠️  developer_applications table does not exist, skipping...`);
      } else {
        throw error;
      }
    }
    
    // 8. Create Notifications
    console.log('\n8️⃣ Creating Notifications...');
    const notifications = [
      {
        user_id: developerId,
        type: 'Project Match',
        title: 'New Project Match Found',
        message: 'A new project "E-commerce Platform Development" matches your skills!',
        category: 'match',
        priority: 'high',
        related_entity_id: projectIds[0] || null,
        related_entity_type: 'project'
      },
      {
        user_id: projectOwnerId,
        type: 'New Applicant',
        title: 'New Application Received',
        message: 'You have received a new application for your project.',
        category: 'application',
        priority: 'medium',
        related_entity_id: projectIds[0] || null,
        related_entity_type: 'project'
      }
    ];
    
    for (const notif of notifications) {
      await client.query(
        `INSERT INTO notifications (
          user_id, type, title, message, category, priority,
          related_entity_id, related_entity_type, read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING`,
        [
          notif.user_id,
          notif.type,
          notif.title,
          notif.message,
          notif.category,
          notif.priority,
          notif.related_entity_id,
          notif.related_entity_type,
          false
        ]
      );
    }
    console.log(`   ✅ Created ${notifications.length} notifications`);
    
    // 9. Create Billing/Subscription Data
    console.log('\n9️⃣ Creating Billing Data...');
    // Get Free plan ID
    const freePlan = await client.query(
      `SELECT id FROM subscription_plans WHERE name = 'Free' LIMIT 1`
    );
    
    if (freePlan.rows.length > 0) {
      const freePlanId = freePlan.rows[0].id;
      
      // Check if subscription exists for project owner
      const poSubCheck = await client.query(
        `SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1`,
        [projectOwnerId]
      );
      if (poSubCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO user_subscriptions (user_id, plan, status, current_period_start, current_period_end)
           VALUES ($1, 'Free', 'active', NOW(), NOW() + INTERVAL '1 month')`,
          [projectOwnerId]
        );
      }
      
      // Check if subscription exists for developer
      const devSubCheck = await client.query(
        `SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1`,
        [developerId]
      );
      if (devSubCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO user_subscriptions (user_id, plan, status, current_period_start, current_period_end)
           VALUES ($1, 'Free', 'active', NOW(), NOW() + INTERVAL '1 month')`,
          [developerId]
        );
      }
      
      console.log(`   ✅ Created subscriptions for users`);
    }
    
    // 10. Create Portfolio Sync Integration Token (GitHub)
    console.log('\n🔟 Creating Portfolio Sync Data...');
    try {
      const tokenCheck = await client.query(
        `SELECT id FROM integration_tokens WHERE user_id = $1 AND platform = $2 LIMIT 1`,
        [developerId, 'github']
      );
      if (tokenCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO integration_tokens (
            user_id, platform, platform_username, access_token, 
            token_type, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            developerId,
            'github',
            'raorajan',
            'dummy_token_for_testing',
            'Bearer',
            true
          ]
        );
        console.log(`   ✅ Created GitHub integration token for Developer`);
      } else {
        console.log(`   ℹ️  GitHub integration token already exists for Developer`);
      }
    } catch (error) {
      if (error.code === '42P01') {
        console.log(`   ⚠️  integration_tokens table does not exist, skipping...`);
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 Dummy data insertion completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Developer: ${DEVELOPER_EMAIL} (ID: ${developerId})`);
    console.log(`   - Project Owner: ${PROJECT_OWNER_EMAIL} (ID: ${projectOwnerId})`);
    console.log(`   - Admin: ${ADMIN_EMAIL} (ID: ${adminId})`);
    console.log(`   - Projects created: ${projectIds.length}`);
    console.log(`   - Password for all users: ${DEFAULT_PASSWORD}`);
    console.log('\n✅ All users are ready for API testing!');
    
  } catch (error) {
    console.error('\n❌ Error inserting dummy data:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

insertDummyData().catch(console.error);

