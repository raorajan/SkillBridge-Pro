const {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  json,
  boolean,
} = require("drizzle-orm/pg-core");
const { eq, and, desc } = require("drizzle-orm");
const { db } = require("../config/database");
const crypto = require("crypto");

// Integration tokens table - stores OAuth tokens securely
const integrationTokensTable = pgTable("integration_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform").notNull(), // 'github', 'stackoverflow'
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenType: text("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  platformUserId: text("platform_user_id"), // GitHub username, StackOverflow user ID
  platformUsername: text("platform_username"), // GitHub username, StackOverflow username
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Portfolio sync data table - stores synced portfolio information
const portfolioSyncDataTable = pgTable("portfolio_sync_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform").notNull(), // 'github', 'stackoverflow', 'portfolio'
  dataType: text("data_type").notNull(), // 'repository', 'commit', 'answer', 'skill', etc.
  platformItemId: text("platform_item_id"), // External platform's item ID
  title: text("title"),
  description: text("description"),
  url: text("url"),
  metadata: json("metadata"), // Additional data (languages, tags, stars, etc.)
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Sync history table - logs all sync operations
const syncHistoryTable = pgTable("sync_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform"), // 'github', 'stackoverflow', 'all'
  status: text("status").notNull(), // 'success', 'partial', 'failed'
  itemsSynced: integer("items_synced").default(0),
  itemsUpdated: integer("items_updated").default(0),
  itemsFailed: integer("items_failed").default(0),
  errorMessage: text("error_message"),
  metadata: json("metadata"), // Additional sync details
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Skill scores table - stores calculated skill scores
const skillScoresTable = pgTable("skill_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform"), // 'github', 'stackoverflow', 'portfolio', 'overall'
  skillName: text("skill_name").notNull(),
  score: integer("score").default(0), // 0-100
  level: text("level"), // 'beginner', 'intermediate', 'advanced', 'expert'
  evidenceCount: integer("evidence_count").default(0), // Number of projects/commits/answers
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Encryption key (in production, use environment variable)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-cbc";

// Encryption helper functions
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encrypted = parts.join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

class PortfolioSyncModel {
  // ========== Integration Tokens ==========
  static async upsertIntegrationToken(userId, platform, tokenData) {
    const encryptedAccessToken = tokenData.accessToken ? encrypt(tokenData.accessToken) : null;
    const encryptedRefreshToken = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;

    const existing = await db
      .select()
      .from(integrationTokensTable)
      .where(and(eq(integrationTokensTable.userId, userId), eq(integrationTokensTable.platform, platform)));

    const tokenRecord = {
      userId,
      platform,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenType: tokenData.tokenType || "Bearer",
      expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
      scope: tokenData.scope,
      platformUserId: tokenData.platformUserId,
      platformUsername: tokenData.platformUsername,
      isActive: tokenData.isActive !== undefined ? tokenData.isActive : true,
      updatedAt: new Date(),
    };

    if (existing && existing.length > 0) {
      const [updated] = await db
        .update(integrationTokensTable)
        .set(tokenRecord)
        .where(eq(integrationTokensTable.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(integrationTokensTable).values(tokenRecord).returning();
      return created;
    }
  }

  static async getIntegrationToken(userId, platform) {
    const [token] = await db
      .select()
      .from(integrationTokensTable)
      .where(
        and(
          eq(integrationTokensTable.userId, userId),
          eq(integrationTokensTable.platform, platform),
          eq(integrationTokensTable.isActive, true)
        )
      );

    if (token && token.accessToken) {
      return {
        ...token,
        accessToken: decrypt(token.accessToken),
        refreshToken: token.refreshToken ? decrypt(token.refreshToken) : null,
      };
    }
    return token;
  }

  static async getAllIntegrationTokens(userId) {
    const tokens = await db
      .select()
      .from(integrationTokensTable)
      .where(and(eq(integrationTokensTable.userId, userId), eq(integrationTokensTable.isActive, true)));

    return tokens.map((token) => ({
      ...token,
      accessToken: token.accessToken ? decrypt(token.accessToken) : null,
      refreshToken: token.refreshToken ? decrypt(token.refreshToken) : null,
    }));
  }

  static async deleteIntegrationToken(userId, platform) {
    await db
      .update(integrationTokensTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(integrationTokensTable.userId, userId),
          eq(integrationTokensTable.platform, platform)
        )
      );
    return true;
  }

  // ========== Portfolio Sync Data ==========
  static async upsertSyncData(userId, platform, dataType, items) {
    // Delete existing data for this platform and data type
    await db
      .delete(portfolioSyncDataTable)
      .where(
        and(
          eq(portfolioSyncDataTable.userId, userId),
          eq(portfolioSyncDataTable.platform, platform),
          eq(portfolioSyncDataTable.dataType, dataType)
        )
      );

    // Insert new data
    if (items && items.length > 0) {
      const insertData = items.map((item) => ({
        userId,
        platform,
        dataType,
        platformItemId: item.id?.toString(),
        title: item.title || item.name,
        description: item.description,
        url: item.url || item.html_url,
        metadata: item.metadata || item,
        syncedAt: new Date(),
      }));

      await db.insert(portfolioSyncDataTable).values(insertData);
    }

    return true;
  }

  static async getSyncData(userId, platform = null, dataType = null) {
    const conditions = [eq(portfolioSyncDataTable.userId, userId)];
    
    if (platform) {
      conditions.push(eq(portfolioSyncDataTable.platform, platform));
    }
    
    if (dataType) {
      conditions.push(eq(portfolioSyncDataTable.dataType, dataType));
    }

    const data = await db
      .select()
      .from(portfolioSyncDataTable)
      .where(and(...conditions));

    return data;
  }

  // ========== Sync History ==========
  static async createSyncHistory(userId, platform, status, details) {
    const [history] = await db
      .insert(syncHistoryTable)
      .values({
        userId,
        platform,
        status,
        itemsSynced: details.itemsSynced || 0,
        itemsUpdated: details.itemsUpdated || 0,
        itemsFailed: details.itemsFailed || 0,
        errorMessage: details.errorMessage,
        metadata: details.metadata,
        startedAt: details.startedAt || new Date(),
        completedAt: details.completedAt || new Date(),
      })
      .returning();

    return history;
  }

  static async getSyncHistory(userId, limit = 10) {
    const history = await db
      .select()
      .from(syncHistoryTable)
      .where(eq(syncHistoryTable.userId, userId))
      .orderBy(desc(syncHistoryTable.startedAt))
      .limit(limit);

    return history;
  }

  // ========== Skill Scores ==========
  static async upsertSkillScores(userId, platform, skills) {
    // Delete existing scores for this platform
    await db
      .delete(skillScoresTable)
      .where(
        and(
          eq(skillScoresTable.userId, userId),
          eq(skillScoresTable.platform, platform)
        )
      );

    // Insert new scores
    if (skills && Object.keys(skills).length > 0) {
      const insertData = Object.entries(skills).map(([skillName, skillData]) => ({
        userId,
        platform,
        skillName,
        score: skillData.score || 0,
        level: skillData.level,
        evidenceCount: skillData.evidenceCount || 0,
        lastCalculatedAt: new Date(),
      }));

      await db.insert(skillScoresTable).values(insertData);
    }

    return true;
  }

  static async getSkillScores(userId, platform = null) {
    const conditions = [eq(skillScoresTable.userId, userId)];
    
    if (platform) {
      conditions.push(eq(skillScoresTable.platform, platform));
    }

    const scores = await db
      .select()
      .from(skillScoresTable)
      .where(and(...conditions));

    return scores;
  }

  static async getOverallSkillScore(userId) {
    // Calculate overall score from all platforms
    const allScores = await this.getSkillScores(userId);
    
    // Group by skill name and calculate average
    const skillMap = {};
    allScores.forEach((score) => {
      if (!skillMap[score.skillName]) {
        skillMap[score.skillName] = {
          scores: [],
          totalEvidence: 0,
        };
      }
      skillMap[score.skillName].scores.push(score.score);
      skillMap[score.skillName].totalEvidence += score.evidenceCount;
    });

    // Calculate weighted average
    const overallSkills = {};
    Object.entries(skillMap).forEach(([skillName, data]) => {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      overallSkills[skillName] = {
        score: Math.round(avgScore),
        evidenceCount: data.totalEvidence,
        level: this.getLevelFromScore(avgScore),
      };
    });

    // Calculate overall portfolio score (average of all skill scores)
    const overallScore = Object.values(overallSkills).length > 0
      ? Math.round(
          Object.values(overallSkills).reduce((sum, skill) => sum + skill.score, 0) /
            Object.values(overallSkills).length
        )
      : 0;

    return {
      overallScore,
      skills: overallSkills,
    };
  }

  static getLevelFromScore(score) {
    if (score >= 80) return "expert";
    if (score >= 60) return "advanced";
    if (score >= 40) return "intermediate";
    return "beginner";
  }

  // ========== Get Developer Portfolio Sync Data (for project owners) ==========
  /**
   * Get portfolio sync data for a specific developer
   * This is used by project owners to view developers' portfolio sync data
   */
  static async getDeveloperPortfolioSyncData(developerId) {
    try {
      // Get all integration tokens for the developer
      const tokens = await this.getAllIntegrationTokens(developerId).catch(() => []);

      // Get last sync history for each platform
      const syncHistory = await this.getSyncHistory(developerId, 50).catch(() => []);
      
      // Get overall skill scores
      const overallSkills = await this.getOverallSkillScore(developerId).catch(() => ({
        overallScore: 0,
        skills: []
      }));

      // Get sync data counts
      const githubData = await this.getSyncData(developerId, "github").catch(() => []);
      const stackoverflowData = await this.getSyncData(developerId, "stackoverflow").catch(() => []);

      return {
        integrations: {
          github: {
            connected: tokens.some((t) => t.platform === "github"),
            lastSync: syncHistory.find((h) => h.platform === "github")?.completedAt || null,
            dataCount: githubData.length,
          },
          stackoverflow: {
            connected: tokens.some((t) => t.platform === "stackoverflow"),
            lastSync: syncHistory.find((h) => h.platform === "stackoverflow")?.completedAt || null,
            dataCount: stackoverflowData.length,
          },
        },
        overallScore: overallSkills.overallScore || 0,
        skills: overallSkills.skills || [],
      };
    } catch (error) {
      console.error("Error in getDeveloperPortfolioSyncData:", error);
      // Return empty data structure instead of throwing
      return {
        integrations: {
          github: {
            connected: false,
            lastSync: null,
            dataCount: 0,
          },
          stackoverflow: {
            connected: false,
            lastSync: null,
            dataCount: 0,
          },
        },
        overallScore: 0,
        skills: [],
      };
    }
  }
}

module.exports = {
  PortfolioSyncModel,
  integrationTokensTable,
  portfolioSyncDataTable,
  syncHistoryTable,
  skillScoresTable,
};

