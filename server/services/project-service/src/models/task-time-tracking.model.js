const { pgTable, serial, text, integer, timestamp, boolean } = require("drizzle-orm/pg-core");
const { eq, and, desc, asc, sql } = require("drizzle-orm");
const { db } = require("../config/database");
const { projectTasksTable } = require("./project-tasks.model");

// Task Time Tracking table - for developers to track time spent on tasks
const taskTimeTrackingTable = pgTable("task_time_tracking", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => projectTasksTable.id, { onDelete: "cascade" }), // FK -> project_tasks.id
  userId: integer("user_id").notNull(), // FK -> users.id (developer tracking time)
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // Duration in milliseconds
  description: text("description"), // Optional description of work done
  isActive: boolean("is_active").default(false), // Currently active timer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task Time Tracking Model Class
class TaskTimeTrackingModel {
  static async startTimer({ taskId, userId, description }) {
    // Stop any existing active timers for this user
    await db
      .update(taskTimeTrackingTable)
      .set({
        endTime: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskTimeTrackingTable.userId, userId),
          eq(taskTimeTrackingTable.isActive, true)
        )
      );
    
    // Create new timer
    const [row] = await db.insert(taskTimeTrackingTable).values({
      taskId,
      userId,
      startTime: new Date(),
      description,
      isActive: true,
    }).returning();
    
    return row;
  }

  static async stopTimer(trackingId, userId) {
    const tracking = await this.getTrackingById(trackingId);
    if (!tracking || tracking.userId !== userId) {
      throw new Error("You can only stop your own timers");
    }
    
    const endTime = new Date();
    const duration = endTime - tracking.startTime;
    
    const [row] = await db
      .update(taskTimeTrackingTable)
      .set({
        endTime,
        duration,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(taskTimeTrackingTable.id, trackingId))
      .returning();
    
    return row;
  }

  static async stopActiveTimer(userId) {
    const activeTracking = await this.getActiveTracking(userId);
    if (!activeTracking) {
      return null;
    }
    
    return await this.stopTimer(activeTracking.id, userId);
  }

  static async getTrackingById(trackingId) {
    const [tracking] = await db
      .select()
      .from(taskTimeTrackingTable)
      .where(eq(taskTimeTrackingTable.id, trackingId));
    return tracking;
  }

  static async getActiveTracking(userId) {
    const [tracking] = await db
      .select()
      .from(taskTimeTrackingTable)
      .where(
        and(
          eq(taskTimeTrackingTable.userId, userId),
          eq(taskTimeTrackingTable.isActive, true)
        )
      );
    return tracking;
  }

  static async getTimeTrackingByTaskId(taskId) {
    return await db
      .select()
      .from(taskTimeTrackingTable)
      .where(eq(taskTimeTrackingTable.taskId, taskId))
      .orderBy(desc(taskTimeTrackingTable.startTime));
  }

  static async getTimeTrackingByUser(userId, options = {}) {
    const { taskId, limit } = options;
    const conditions = [eq(taskTimeTrackingTable.userId, userId)];
    
    // Only add taskId filter if it's a valid number (not NaN or null)
    if (taskId && !isNaN(taskId) && typeof taskId === 'number' && taskId > 0) {
      conditions.push(eq(taskTimeTrackingTable.taskId, taskId));
    }
    
    let query = db
      .select()
      .from(taskTimeTrackingTable)
      .where(and(...conditions))
      .orderBy(desc(taskTimeTrackingTable.startTime));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query;
  }

  static async getTotalTimeForTask(taskId, userId) {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(duration), 0) as total_duration
      FROM task_time_tracking
      WHERE task_id = ${taskId} AND user_id = ${userId}
    `);
    
    return Number(result.rows?.[0]?.total_duration || 0);
  }

  static async getTotalTimeForUser(userId, options = {}) {
    const { startDate, endDate } = options;
    
    let query = sql`
      SELECT COALESCE(SUM(duration), 0) as total_duration
      FROM task_time_tracking
      WHERE user_id = ${userId}
    `;
    
    // Validate dates before using them
    if (startDate && startDate instanceof Date && !isNaN(startDate.getTime())) {
      query = sql`${query} AND start_time >= ${startDate}`;
    }
    if (endDate && endDate instanceof Date && !isNaN(endDate.getTime())) {
      query = sql`${query} AND start_time <= ${endDate}`;
    }
    
    const result = await db.execute(query);
    return Number(result.rows?.[0]?.total_duration || 0);
  }

  static async updateTracking(trackingId, userId, updateData) {
    // Verify ownership
    const existingTracking = await this.getTrackingById(trackingId);
    if (!existingTracking || existingTracking.userId !== userId) {
      throw new Error("You can only update your own time tracking");
    }
    
    const [row] = await db
      .update(taskTimeTrackingTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(taskTimeTrackingTable.id, trackingId))
      .returning();
    return row;
  }

  static async deleteTracking(trackingId, userId) {
    // Verify ownership
    const existingTracking = await this.getTrackingById(trackingId);
    if (!existingTracking || existingTracking.userId !== userId) {
      throw new Error("You can only delete your own time tracking");
    }
    
    const [row] = await db
      .delete(taskTimeTrackingTable)
      .where(eq(taskTimeTrackingTable.id, trackingId))
      .returning();
    return row;
  }
}

module.exports = {
  taskTimeTrackingTable,
  TaskTimeTrackingModel,
};

