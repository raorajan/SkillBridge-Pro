const {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  json,
  uuid,
  pgEnum,
} = require("drizzle-orm/pg-core");

const { eq, and, or, ne, ilike, desc } = require("drizzle-orm");

const { db } = require("../config/database");

// Define enum for roles
const roleEnum = pgEnum("role", ["developer", "project-owner", "admin"]);

const userTable = pgTable("users", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().unique().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: varchar("password", { length: 255 }),
  oauthProvider: text("oauth_provider"),
  oauthId: text("oauth_id"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  domainPreferences: text("domain_preferences"),
  skills: json("skills"),
  experience: text("experience"),
  location: text("location"),
  availability: text("availability"),
  resumeUrl: text("resume_url"),
  xp: integer("xp").default(0),
  badges: json("badges").default([]),
  level: integer("level").default(1),
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  stackoverflowUrl: text("stackoverflow_url"),
  portfolioUrl: text("portfolio_url"),
  portfolioScore: integer("portfolio_score"),
  isEmailVerified: boolean("is_email_verified").default(false),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpire: timestamp("reset_password_expire"),
  notificationPrefs: json("notification_prefs").default({}),
  role: roleEnum("role").default("developer").notNull(), // Keep for backward compatibility
  roles: json("roles").default([]), // New: array of roles
  isDeleted: boolean("is_deleted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Developer Favorites table
const developerFavoritesTable = pgTable("developer_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Project owner who is favoriting
  developerId: integer("developer_id").notNull(), // Developer being favorited
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Developer Saves table
const developerSavesTable = pgTable("developer_saves", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Project owner who is saving
  developerId: integer("developer_id").notNull(), // Developer being saved
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Developer Applications table (Project owner reaching out to developer)
const developerApplicationsTable = pgTable("developer_applications", {
  id: serial("id").primaryKey(),
  projectOwnerId: integer("project_owner_id").notNull(), // Project owner who is reaching out
  developerId: integer("developer_id").notNull(), // Developer being contacted
  projectId: integer("project_id"), // Optional: associated project
  message: text("message"), // Message from project owner
  notes: text("notes"), // Internal notes
  status: text("status").default("pending"), // pending, accepted, rejected
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

class UserModel {
  static async createUser(userObject) {
    const [user] = await db.insert(userTable).values(userObject).returning();
    return user;
  }

  static async getUserById(id) {
    const [user] = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)));
    return user;
  }

  static async getUserByUUID(uuid) {
    const [user] = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.uuid, uuid), eq(userTable.isDeleted, false)));
    return user;
  }

  static async getUserByEmail(email) {
    const [user] = await db
      .select()
      .from(userTable)
      .where(and(eq(userTable.email, email), eq(userTable.isDeleted, false)));
    return user;
  }

  static async updateUser(id, userObject) {
    const [user] = await db
      .update(userTable)
      .set(userObject)
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async deleteUser(id) {
    const [user] = await db
      .update(userTable)
      .set({ isDeleted: true })
      .where(eq(userTable.id, id))
      .returning();
    return user;
  }

  static async getAllUsers() {
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.isDeleted, false));
    return users;
  }

  static async getDevelopers(filters = {}) {
    const { 
      search,
      experience,
      location,
      skills,
      availability,
      limit = 20,
      page = 1
    } = filters;

    let query = db
      .select()
      .from(userTable)
      .where(
        and(
          eq(userTable.isDeleted, false),
          eq(userTable.role, 'developer')
        )
      );

    // Add search filter if provided
    if (search) {
      query = query.where(
        and(
          eq(userTable.isDeleted, false),
          eq(userTable.role, 'developer'),
          or(
            ilike(userTable.name, `%${search}%`),
            ilike(userTable.bio, `%${search}%`),
            ilike(userTable.domainPreferences, `%${search}%`)
          )
        )
      );
    }

    // Add experience filter if provided
    if (experience && experience !== 'all') {
      query = query.where(
        and(
          eq(userTable.isDeleted, false),
          eq(userTable.role, 'developer'),
          eq(userTable.experience, experience)
        )
      );
    }

    // Add location filter if provided
    if (location && location !== 'all') {
      if (location === 'remote') {
        query = query.where(
          and(
            eq(userTable.isDeleted, false),
            eq(userTable.role, 'developer'),
            or(
              ilike(userTable.location, '%remote%'),
              eq(userTable.location, 'Remote')
            )
          )
        );
      } else {
        query = query.where(
          and(
            eq(userTable.isDeleted, false),
            eq(userTable.role, 'developer'),
            ilike(userTable.location, `%${location}%`)
          )
        );
      }
    }

    // Add availability filter if provided
    if (availability && availability !== 'all') {
      query = query.where(
        and(
          eq(userTable.isDeleted, false),
          eq(userTable.role, 'developer'),
          eq(userTable.availability, availability)
        )
      );
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    // Order by XP (level) descending
    query = query.orderBy(desc(userTable.xp));

    const developers = await query;
    return developers;
  }

  /**
   * Get users by roles (for chat purposes - developers and project-owners)
   */
  static async getUsersByRoles(roles = ['developer', 'project-owner'], filters = {}) {
    const { 
      search,
      limit = 200,
      excludeUserId = null
    } = filters;

    // Build base conditions
    const baseConditions = [
      eq(userTable.isDeleted, false),
      or(...roles.map(role => eq(userTable.role, role)))
    ];

    // Add exclude user condition if provided
    if (excludeUserId) {
      baseConditions.push(ne(userTable.id, parseInt(excludeUserId)));
    }

    // Add search conditions if provided
    if (search) {
      baseConditions.push(
        or(
          ilike(userTable.name, `%${search}%`),
          ilike(userTable.email, `%${search}%`),
          ilike(userTable.bio, `%${search}%`)
        )
      );
    }

    // Build query with all conditions
    let query = db
      .select()
      .from(userTable)
      .where(and(...baseConditions))
      .limit(parseInt(limit))
      .orderBy(desc(userTable.createdAt));

    const users = await query;
    return users;
  }

  static async verifyEmail(id) {
    const [user] = await db
      .update(userTable)
      .set({ isEmailVerified: true })
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async getUserByResetToken(hashedToken) {
    const [user] = await db
      .select()
      .from(userTable)
      .where(
        and(
          eq(userTable.resetPasswordToken, hashedToken),
          eq(userTable.isDeleted, false)
        )
      );
    return user;
  }

  static async setResetPasswordToken(id, tokenHash, expireTime) {
    const [user] = await db
      .update(userTable)
      .set({
        resetPasswordToken: tokenHash,
        resetPasswordExpire: expireTime,
      })
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async clearResetPasswordToken(id) {
    const [user] = await db
      .update(userTable)
      .set({
        resetPasswordToken: null,
        resetPasswordExpire: null,
      })
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async updateOAuthDetails(id, oauthDetails) {
    const [user] = await db
      .update(userTable)
      .set(oauthDetails)
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async updatePassword(id, newPassword) {
    const [user] = await db
      .update(userTable)
      .set({ password: newPassword })
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async updateResumeUrl(id, url) {
    const [user] = await db
      .update(userTable)
      .set({ resumeUrl: url })
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();
    return user;
  }

  static async updateProfile(id, profile) {
    const updateData = { ...profile };

    // 🔒 Never allow immutable fields
    delete updateData.id;
    delete updateData.uuid;
    delete updateData.createdAt;

    // ✅ Always let DB handle updatedAt
    updateData.updatedAt = new Date();

    // ✅ Ensure JSON fields are real objects/arrays, not strings
    if (typeof updateData.skills === "string") {
      try {
        updateData.skills = JSON.parse(updateData.skills);
      } catch {
        updateData.skills = {};
      }
    }

    if (typeof updateData.badges === "string") {
      try {
        updateData.badges = JSON.parse(updateData.badges);
      } catch {
        updateData.badges = [];
      }
    }

    if (typeof updateData.notificationPrefs === "string") {
      try {
        updateData.notificationPrefs = JSON.parse(updateData.notificationPrefs);
      } catch {
        updateData.notificationPrefs = {};
      }
    }

    // ✅ Normalize resetPasswordExpire if present
    if (updateData.resetPasswordExpire) {
      const date = new Date(updateData.resetPasswordExpire);
      updateData.resetPasswordExpire = isNaN(date) ? null : date;
    }

    const [user] = await db
      .update(userTable)
      .set(updateData)
      .where(and(eq(userTable.id, id), eq(userTable.isDeleted, false)))
      .returning();

    return user;
  }

  // Role management methods
  static async assignRole(userId, role, assignedBy = null) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get current roles
    let currentRoles = user.roles || [];
    
    // Check if user already has this role
    if (currentRoles.includes(role)) {
      throw new Error(`User already has the role: ${role}`);
    }

    // Add the new role
    currentRoles.push(role);

    // Update user with new roles
    const [updatedUser] = await db
      .update(userTable)
      .set({ 
        roles: currentRoles,
        updatedAt: new Date()
      })
      .where(and(eq(userTable.id, userId), eq(userTable.isDeleted, false)))
      .returning();

    return updatedUser;
  }

  static async removeRole(userId, role) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get current roles
    let currentRoles = user.roles || [];
    
    // Check if user has this role
    if (!currentRoles.includes(role)) {
      throw new Error(`User does not have the role: ${role}`);
    }

    // Remove the role
    currentRoles = currentRoles.filter(r => r !== role);

    // Update user with updated roles
    const [updatedUser] = await db
      .update(userTable)
      .set({ 
        roles: currentRoles,
        updatedAt: new Date()
      })
      .where(and(eq(userTable.id, userId), eq(userTable.isDeleted, false)))
      .returning();

    return updatedUser;
  }

  static async getUserRoles(userId) {
    const user = await this.getUserById(userId);
    if (!user) return [];

    return user.roles || [];
  }

  static async hasRole(userId, role) {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const roles = user.roles || [];
    return roles.includes(role);
  }

  static async hasAnyRole(userId, roles) {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const userRoles = user.roles || [];
    return roles.some(role => userRoles.includes(role));
  }

  // Get user with roles (roles are already included in user object)
  static async getUserWithRoles(id) {
    return await this.getUserById(id);
  }

  static async getUserByEmailWithRoles(email) {
    return await this.getUserByEmail(email);
  }

  static async getUserByUUIDWithRoles(uuid) {
    return await this.getUserByUUID(uuid);
  }

  // ============================================
  // DEVELOPER FAVORITES
  // ============================================
  
  static async addDeveloperFavorite(userId, developerId) {
    const [favorite] = await db
      .insert(developerFavoritesTable)
      .values({ userId, developerId })
      .returning();
    return favorite;
  }

  static async removeDeveloperFavorite(userId, developerId) {
    try {
      await db
        .delete(developerFavoritesTable)
        .where(
          and(
            eq(developerFavoritesTable.userId, userId),
            eq(developerFavoritesTable.developerId, developerId)
          )
        );
      return true;
    } catch (error) {
      console.error("Error removing developer favorite:", error);
      // Return true even if not found (idempotent operation)
      return true;
    }
  }

  static async getDeveloperFavorites(userId) {
    try {
      const { sql } = require("drizzle-orm");
      
      const favorites = await db.execute(sql`
        SELECT 
          df.id,
          df.user_id as "userId",
          df.developer_id as "developerId",
          df.created_at as "createdAt",
          u.id as "developer_id",
          u.name,
          u.email,
          u.bio,
          u.avatar_url as "avatarUrl",
          u.skills,
          u.experience,
          u.location,
          u.availability,
          u.github_url as "githubUrl",
          u.linkedin_url as "linkedinUrl",
          u.portfolio_url as "portfolioUrl",
          u.xp,
          u.level
        FROM developer_favorites df
        LEFT JOIN users u ON df.developer_id = u.id
        WHERE df.user_id = ${userId} AND (u.is_deleted = false OR u.is_deleted IS NULL)
        ORDER BY df.created_at DESC
      `);
      
      return favorites.rows || [];
    } catch (error) {
      console.error("Error fetching developer favorites:", error);
      // Return empty array if query fails (table might not exist yet)
      return [];
    }
  }

  // ============================================
  // DEVELOPER SAVES
  // ============================================
  
  static async addDeveloperSave(userId, developerId) {
    try {
      const [save] = await db
        .insert(developerSavesTable)
        .values({ userId, developerId })
        .returning();
      return save;
    } catch (error) {
      console.error("Error adding developer save:", error);
      // Handle duplicate key error
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new Error("Developer already saved");
      }
      throw error;
    }
  }

  static async removeDeveloperSave(userId, developerId) {
    try {
      await db
        .delete(developerSavesTable)
        .where(
          and(
            eq(developerSavesTable.userId, userId),
            eq(developerSavesTable.developerId, developerId)
          )
        );
      return true;
    } catch (error) {
      console.error("Error removing developer save:", error);
      // Return true even if not found (idempotent operation)
      return true;
    }
  }

  static async getDeveloperSaves(userId) {
    try {
      const { sql } = require("drizzle-orm");
      
      const saves = await db.execute(sql`
        SELECT 
          ds.id,
          ds.user_id as "userId",
          ds.developer_id as "developerId",
          ds.created_at as "createdAt",
          u.id as "developer_id",
          u.name,
          u.email,
          u.bio,
          u.avatar_url as "avatarUrl",
          u.skills,
          u.experience,
          u.location,
          u.availability,
          u.github_url as "githubUrl",
          u.linkedin_url as "linkedinUrl",
          u.portfolio_url as "portfolioUrl",
          u.xp,
          u.level
        FROM developer_saves ds
        LEFT JOIN users u ON ds.developer_id = u.id
        WHERE ds.user_id = ${userId} AND (u.is_deleted = false OR u.is_deleted IS NULL)
        ORDER BY ds.created_at DESC
      `);
      
      return saves.rows || [];
    } catch (error) {
      console.error("Error fetching developer saves:", error);
      // Return empty array if query fails (table might not exist yet)
      return [];
    }
  }

  // ============================================
  // DEVELOPER APPLICATIONS (Project Owner Outreach)
  // ============================================
  
  static async applyToDeveloper(applicationData) {
    try {
      const { projectOwnerId, developerId, projectId, message, notes } = applicationData;
      
      const [application] = await db
        .insert(developerApplicationsTable)
        .values({
          projectOwnerId,
          developerId,
          projectId,
          message,
          notes,
          status: 'pending'
        })
        .returning();
      
      return application;
    } catch (error) {
      console.error("Error applying to developer:", error);
      // Handle duplicate key error
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new Error("Application already exists");
      }
      throw error;
    }
  }

  static async withdrawDeveloperApplication(projectOwnerId, developerId) {
    try {
      const [result] = await db
        .delete(developerApplicationsTable)
        .where(
          and(
            eq(developerApplicationsTable.projectOwnerId, projectOwnerId),
            eq(developerApplicationsTable.developerId, developerId)
          )
        )
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error withdrawing developer application:", error);
      // Return null if not found (idempotent operation)
      return null;
    }
  }

  static async getMyDeveloperApplications(projectOwnerId) {
    try {
      const { sql } = require("drizzle-orm");
      
      const applications = await db.execute(sql`
        SELECT 
          da.id as "applicationId",
          da.project_owner_id as "projectOwnerId",
          da.developer_id as "developerId",
          da.project_id as "projectId",
          da.message,
          da.notes,
          da.status,
          da.applied_at as "appliedAt",
          da.updated_at as "updatedAt",
          u.id as "developer_id",
          u.name,
          u.email,
          u.bio,
          u.avatar_url as "avatarUrl",
          u.skills,
          u.experience,
          u.location,
          u.availability,
          u.github_url as "githubUrl",
          u.linkedin_url as "linkedinUrl",
          u.portfolio_url as "portfolioUrl",
          u.xp,
          u.level
        FROM developer_applications da
        LEFT JOIN users u ON da.developer_id = u.id
        WHERE da.project_owner_id = ${projectOwnerId} AND (u.is_deleted = false OR u.is_deleted IS NULL)
        ORDER BY da.applied_at DESC
      `);
      
      return applications.rows || [];
    } catch (error) {
      console.error("Error fetching developer applications:", error);
      return [];
    }
  }

  static async getMyDeveloperApplicationsCount(projectOwnerId) {
    try {
      const { sql } = require("drizzle-orm");
      
      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM developer_applications da
        LEFT JOIN users u ON da.developer_id = u.id
        WHERE da.project_owner_id = ${projectOwnerId} AND (u.is_deleted = false OR u.is_deleted IS NULL)
      `);
      
      return result.rows[0]?.count || 0;
    } catch (error) {
      console.error("Error fetching developer applications count:", error);
      return 0;
    }
  }

  static async getAppliedDevelopers(projectOwnerId) {
    try {
      const { sql } = require("drizzle-orm");
      
      const appliedDevelopers = await db.execute(sql`
        SELECT 
          da.id as "applicationId",
          da.developer_id as "developerId",
          da.project_id as "projectId",
          da.status,
          da.applied_at as "appliedAt",
          da.message,
          da.notes,
          u.id as "developer_id",
          u.name,
          u.email,
          u.bio,
          u.avatar_url as "avatarUrl",
          u.skills,
          u.experience,
          u.location,
          u.availability,
          u.github_url as "githubUrl",
          u.linkedin_url as "linkedinUrl",
          u.portfolio_url as "portfolioUrl",
          u.xp,
          u.level
        FROM developer_applications da
        LEFT JOIN users u ON da.developer_id = u.id
        WHERE da.project_owner_id = ${projectOwnerId} AND (u.is_deleted = false OR u.is_deleted IS NULL)
        ORDER BY da.applied_at DESC
      `);
      
      return appliedDevelopers.rows || [];
    } catch (error) {
      console.error("Error fetching applied developers:", error);
      return [];
    }
  }

  // ============================================
  // DEVELOPER DASHBOARD / GAMIFICATION
  // ============================================

  /**
   * Get comprehensive developer stats for dashboard
   * Includes: XP, level, reputation, streak, badges, achievements, endorsements, completed projects, ratings
   */
  static async getDeveloperStats(userId) {
    const { sql } = require("drizzle-orm");
    
    // Get user basic info
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }

    // Get completed projects count (projects where user was accepted)
    const completedProjectsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT pa.project_id) as count
      FROM project_applicants pa
      WHERE pa.user_id = ${userId} AND pa.status = 'accepted'
    `);
    const completedProjects = Number(completedProjectsResult.rows[0]?.count || 0);

    // Get average rating and total ratings from project reviews
    // Note: This assumes reviews are about projects, not developers directly
    // If you have developer reviews, adjust this query
    const ratingsResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(pr.rating), 0) as average_rating,
        COUNT(pr.id) as total_ratings
      FROM project_reviews pr
      INNER JOIN project_applicants pa ON pr.project_id = pa.project_id
      WHERE pa.user_id = ${userId} AND pa.status = 'accepted'
    `);
    const averageRating = Number(ratingsResult.rows[0]?.average_rating || 0);
    const totalRatings = Number(ratingsResult.rows[0]?.total_ratings || 0);

    // Calculate weekly XP (XP earned in last 7 days)
    // For now, we'll use a simple calculation - you might want to track XP history
    const weeklyXP = 0; // TODO: Implement XP history tracking

    // Calculate daily XP (XP earned today)
    const dailyXP = 0; // TODO: Implement XP history tracking

    // Calculate streak (consecutive days with activity)
    // For now, we'll use a simple calculation based on recent activity
    const streak = 0; // TODO: Implement activity streak tracking

    // Get badges count
    const badgesCount = Array.isArray(user.badges) ? user.badges.length : 0;

    // Get achievements count (based on badges)
    const achievementsCount = badgesCount;

    // Get endorsements count
    const { EndorsementsModel } = require("./endorsements.model");
    const endorsementsCount = await EndorsementsModel.getDeveloperEndorsementCount(userId);

    // Calculate reputation (based on XP, ratings, completed projects)
    const reputation = Math.round(
      (user.xp / 100) * 0.4 +
      (averageRating * 10) * 0.4 +
      (completedProjects * 5) * 0.2
    );

    // Calculate total XP (cumulative XP earned)
    const totalXP = user.xp || 0;

    return {
      xp: user.xp || 0,
      level: user.level || 1,
      totalXP,
      weeklyXP,
      dailyXP,
      streak,
      reputation: Math.max(0, Math.min(100, reputation)), // Clamp between 0-100
      badges: badgesCount,
      achievements: achievementsCount,
      endorsements: endorsementsCount,
      completedProjects,
      averageRating: Number(averageRating.toFixed(1)),
      totalRatings,
    };
  }

  /**
   * Get reviews received by a developer
   * Fetches reviews from project_reviews table for projects where developer was accepted
   */
  static async getDeveloperReviews(userId, limit = 10) {
    const { sql } = require("drizzle-orm");
    
    try {
      // Get reviews for projects where the developer was accepted
      // Join project_reviews with project_applicants to get reviews for accepted developers
      const reviewsResult = await db.execute(sql`
        SELECT 
          pr.id,
          pr.project_id as "projectId",
          pr.reviewer_id as "reviewerId",
          pr.rating,
          pr.comment as review,
          pr.created_at as date,
          p.title as "projectName",
          u.name as reviewer,
          u.email as "reviewerEmail",
          u.avatar_url as "reviewerAvatar"
        FROM project_reviews pr
        INNER JOIN project_applicants pa ON pr.project_id = pa.project_id
        INNER JOIN projects p ON pr.project_id = p.id
        INNER JOIN users u ON pr.reviewer_id = u.id
        WHERE pa.user_id = ${userId}
        AND pa.status = 'accepted'
        AND p.is_deleted = false
        ORDER BY pr.created_at DESC
        LIMIT ${limit}
      `);
      
      const reviews = reviewsResult.rows.map(row => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName || "Unknown Project",
        reviewer: row.reviewer || "Anonymous",
        reviewerEmail: row.reviewerEmail,
        reviewerAvatar: row.reviewerAvatar,
        rating: Number(row.rating) || 0,
        review: row.review || "",
        date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
        categories: {
          quality: Number(row.rating) || 0,
          communication: Number(row.rating) || 0,
          timeliness: Number(row.rating) || 0,
          professionalism: Number(row.rating) || 0,
          overall: Number(row.rating) || 0,
        },
      }));
      
      return reviews;
    } catch (error) {
      console.error("Error fetching developer reviews:", error);
      return [];
    }
  }

  /**
   * Get endorsements for a developer
   * @param {number} userId - Developer user ID
   * @param {number} limit - Maximum number of endorsements to return
   * @returns {Promise<Array>} Array of endorsements
   */
  static async getDeveloperEndorsements(userId, limit = 10) {
    const { EndorsementsModel } = require("./endorsements.model");
    return await EndorsementsModel.getDeveloperEndorsements(userId, limit);
  }

  /**
   * Get leaderboard (top developers by XP)
   */
  static async getLeaderboard(limit = 10) {
    const developers = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        avatarUrl: userTable.avatarUrl,
        xp: userTable.xp,
        level: userTable.level,
      })
      .from(userTable)
      .where(and(eq(userTable.isDeleted, false), eq(userTable.role, 'developer')))
      .orderBy(desc(userTable.xp))
      .limit(limit);
    
    return developers;
  }

  /**
   * Get developer achievements
   * Based on stats, calculates which achievements are unlocked
   */
  static async getDeveloperAchievements(userId) {
    const stats = await this.getDeveloperStats(userId);
    if (!stats) return [];

    // Helper function to determine rarity based on XP
    const getRarity = (xp) => {
      if (xp < 300) return "common";
      if (xp < 700) return "rare";
      if (xp < 1200) return "epic";
      return "legendary";
    };

    // Helper function to get color gradient based on rarity
    const getColorGradient = (rarity) => {
      const colors = {
        common: "from-yellow-400 via-orange-500 to-red-500",
        rare: "from-blue-500 via-purple-500 to-pink-500",
        epic: "from-green-400 via-blue-500 to-purple-600",
        legendary: "from-orange-400 via-red-500 to-pink-500",
      };
      return colors[rarity] || colors.common;
    };

    // Helper function to get unlocked date (if unlocked, use current date as approximation)
    const getUnlockedDate = (unlocked) => {
      if (!unlocked) return null;
      // In a real scenario, you'd track when each achievement was unlocked
      // For now, we'll return null and let frontend handle it
      return null;
    };

    const achievements = [
      {
        id: 1,
        name: "First Project",
        description: "Complete your first project",
        icon: "Star",
        unlocked: stats.completedProjects >= 1,
        xp: 100,
        points: 100,
        rarity: getRarity(100),
        color: getColorGradient(getRarity(100)),
        unlockedDate: getUnlockedDate(stats.completedProjects >= 1),
      },
      {
        id: 2,
        name: "Streak Master",
        description: "Maintain a 7-day streak",
        icon: "Flame",
        unlocked: stats.streak >= 7,
        xp: 200,
        points: 200,
        rarity: getRarity(200),
        color: getColorGradient(getRarity(200)),
        unlockedDate: getUnlockedDate(stats.streak >= 7),
      },
      {
        id: 3,
        name: "Level Up",
        description: "Reach level 10",
        icon: "Target",
        unlocked: stats.level >= 10,
        xp: 500,
        points: 500,
        rarity: getRarity(500),
        color: getColorGradient(getRarity(500)),
        unlockedDate: getUnlockedDate(stats.level >= 10),
      },
      {
        id: 4,
        name: "XP Collector",
        description: "Earn 10,000 total XP",
        icon: "Zap",
        unlocked: stats.totalXP >= 10000,
        xp: 1000,
        points: 1000,
        rarity: getRarity(1000),
        color: getColorGradient(getRarity(1000)),
        unlockedDate: getUnlockedDate(stats.totalXP >= 10000),
      },
      {
        id: 5,
        name: "Quality Expert",
        description: "Maintain 4.5+ average rating",
        icon: "Award",
        unlocked: stats.averageRating >= 4.5,
        xp: 800,
        points: 800,
        rarity: getRarity(800),
        color: getColorGradient(getRarity(800)),
        unlockedDate: getUnlockedDate(stats.averageRating >= 4.5),
      },
      {
        id: 6,
        name: "Endorsement Magnet",
        description: "Receive 10+ endorsements",
        icon: "ThumbsUp",
        unlocked: stats.endorsements >= 10,
        xp: 600,
        points: 600,
        rarity: getRarity(600),
        color: getColorGradient(getRarity(600)),
        unlockedDate: getUnlockedDate(stats.endorsements >= 10),
      },
    ];

    return achievements;
  }

  // ============================================
  // ADMIN ANALYTICS
  // ============================================

  /**
   * Get comprehensive admin analytics
   * Includes: user stats, project stats, revenue, moderation stats, system health
   */
  static async getAdminAnalytics(timeframe = '6m') {
    const { sql } = require("drizzle-orm");
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    switch (timeframe) {
      case '1w':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1m':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 6);
    }

    // Get total users count
    const totalUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_deleted = false
    `);
    const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

    // Get active developers count (users with role 'developer')
    const activeDevelopersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      WHERE u.is_deleted = false
      AND (u.role = 'developer' OR u.roles::text LIKE '%developer%')
    `);
    const activeDevelopers = Number(activeDevelopersResult.rows[0]?.count || 0);

    // Get project owners count
    const projectOwnersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      WHERE u.is_deleted = false
      AND (u.role = 'project-owner' OR u.roles::text LIKE '%project-owner%')
    `);
    const projectOwners = Number(projectOwnersResult.rows[0]?.count || 0);

    // Get users by month (for chart)
    const usersByMonthResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        EXTRACT(MONTH FROM created_at) as month_num,
        COUNT(*) as count
      FROM users
      WHERE is_deleted = false
      AND created_at >= ${startDate}
      GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);
    const usersByMonth = usersByMonthResult.rows.map(row => ({
      month: row.month,
      count: Number(row.count || 0)
    }));

    // Get monthly growth (users created in last month vs previous month)
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1);
    const previousMonthEnd = lastMonthStart;

    const lastMonthUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_deleted = false
      AND created_at >= ${lastMonthStart}
      AND created_at < ${lastMonthEnd}
    `);
    const lastMonthUsers = Number(lastMonthUsersResult.rows[0]?.count || 0);

    const previousMonthUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_deleted = false
      AND created_at >= ${previousMonthStart}
      AND created_at < ${previousMonthEnd}
    `);
    const previousMonthUsers = Number(previousMonthUsersResult.rows[0]?.count || 0);

    const monthlyGrowth = previousMonthUsers > 0 
      ? ((lastMonthUsers - previousMonthUsers) / previousMonthUsers * 100).toFixed(1)
      : lastMonthUsers > 0 ? 100 : 0;

    // Get user retention (users active in last 30 days / total users)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const activeUsersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      WHERE u.is_deleted = false
      AND u.updated_at >= ${thirtyDaysAgo}
    `);
    const activeUsers = Number(activeUsersResult.rows[0]?.count || 0);
    const userRetention = totalUsers > 0 
      ? ((activeUsers / totalUsers) * 100).toFixed(1)
      : 0;

    // Get average rating (from project reviews - requires cross-service access)
    // For now, return a placeholder - this would need to be calculated from project-service
    const avgRating = 4.5; // TODO: Calculate from project reviews

    // Get revenue (placeholder - would need to be calculated from billing/subscription service)
    const revenue = "$58,000"; // TODO: Calculate from actual revenue data

    // Get flagged content count (placeholder - would need a flagged_content table)
    const flaggedContent = 8; // TODO: Get from flagged_content table

    // Get pending moderation count
    const pendingModeration = 15; // TODO: Get from moderation table

    // Get resolved issues count
    const resolvedIssues = 45; // TODO: Get from issues/resolutions table

    // Get banned users count
    const bannedUsersResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_deleted = true
    `);
    const bannedUsers = Number(bannedUsersResult.rows[0]?.count || 0);

    // Get suspended accounts count (placeholder - would need a suspended field)
    const suspendedAccounts = 7; // TODO: Get from users table where suspended = true

    // Get active sessions (placeholder - would need session tracking)
    const activeSessions = 342; // TODO: Get from active sessions

    // Get system uptime (placeholder - would need system monitoring)
    const systemUptime = 99.9; // TODO: Get from system monitoring

    return {
      stats: {
        totalUsers,
        activeDevelopers,
        projectOwners,
        matchRate: 78, // TODO: Calculate from project matches
        avgRating: parseFloat(avgRating),
        revenue,
        monthlyGrowth: parseFloat(monthlyGrowth),
        userRetention: parseFloat(userRetention),
        systemUptime,
        activeSessions,
        flaggedContent,
        pendingModeration,
        resolvedIssues,
        bannedUsers,
        suspendedAccounts,
      },
      charts: {
        usersByMonth,
      },
      moderation: {
        flaggedUsers: 8, // TODO: Get from flagged_content where type = 'user'
        flaggedProjects: 12, // TODO: Get from flagged_content where type = 'project'
        flaggedMessages: 5, // TODO: Get from flagged_content where type = 'message'
        pendingReviews: pendingModeration,
        resolvedToday: 23, // TODO: Get from moderation where resolved_at = today
        escalationRate: 5.2, // TODO: Calculate escalation rate
        avgResponseTime: "2.3 hours", // TODO: Calculate average response time
        moderatorActivity: 89, // TODO: Calculate moderator activity percentage
      },
      systemHealth: {
        serverUptime: systemUptime,
        responseTime: 245, // TODO: Get from system monitoring
        cpuUsage: 45, // TODO: Get from system monitoring
        memoryUsage: 68, // TODO: Get from system monitoring
        diskUsage: 34, // TODO: Get from system monitoring
        networkLatency: 12, // TODO: Get from system monitoring
        errorRate: 0.1, // TODO: Get from system monitoring
        activeConnections: activeSessions,
      },
    };
  }
}

module.exports = {
  userTable,
  developerFavoritesTable,
  developerSavesTable,
  developerApplicationsTable,
  UserModel,
};
