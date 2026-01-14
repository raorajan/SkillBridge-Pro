const { NotificationsModel } = require("../models/notifications.model");
const ErrorHandler = require("shared/utils/errorHandler");

/**
 * Get all notifications for the authenticated user
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }

    const { type, category, read, priority, archived = false, limit = 100, offset = 0 } = req.query;

    const filters = {
      type: type || undefined,
      category: category || undefined,
      read: read === "true" ? true : read === "false" ? false : undefined,
      priority: priority || undefined,
      archived: archived === "true",
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    };

    const notifications = await NotificationsModel.getNotificationsByUserId(Number(userId), filters);

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Notifications retrieved successfully",
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    console.error("Error details:", {
      message: error.message,
      cause: error.cause?.message || error.cause,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch notifications",
      error: error.cause?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Get unread notifications count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }

    const count = await NotificationsModel.getUnreadCount(Number(userId));

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Unread count retrieved successfully",
      data: { count },
    });
  } catch (error) {
    console.error("Get Unread Count Error:", error);
    console.error("Error details:", {
      message: error.message,
      cause: error.cause?.message || error.cause,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch unread count",
      error: error.cause?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Create a new notification
 */
const createNotification = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { type, title, message, category, priority, action, actionUrl, relatedEntityId, relatedEntityType, metadata } = req.body;

    if (!title || !message) {
      return new ErrorHandler("Title and message are required", 400).sendError(res);
    }

    // If userId is not in body, use authenticated user
    const targetUserId = req.body.userId ? Number(req.body.userId) : Number(userId);
    
    // Default type if not provided - use a valid enum value
    const validTypes = [
      "Project Match", "Application Update", "Invitation", "Task Deadline",
      "Chat Message", "Endorsement", "Review", "Career Opportunity",
      "New Applicant", "Recommended Developer", "Project Update", "Billing Reminder",
      "Project Milestone", "Team Invitation", "Budget Alert", "Flagged User",
      "Dispute Report", "System Alert", "Billing Alert", "Moderation Task",
      "Security Alert", "Platform Health", "User Verification", "Feature Request",
      "Compliance Alert", "Other"
    ];
    const notificationType = type && validTypes.includes(type) ? type : 'Other';

    const notification = await NotificationsModel.createNotification({
      userId: targetUserId,
      type: notificationType,
      title,
      message,
      category,
      priority: priority || "medium",
      action,
      actionUrl,
      relatedEntityId,
      relatedEntityType,
      metadata,
    });

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    console.error("Create Notification Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { notificationId } = req.params;

    if (!notificationId) {
      return new ErrorHandler("Notification ID is required", 400).sendError(res);
    }

    // Verify notification belongs to user
    const notification = await NotificationsModel.getNotificationById(notificationId);
    if (!notification) {
      return new ErrorHandler("Notification not found", 404).sendError(res);
    }

    if (Number(notification.userId) !== Number(userId)) {
      return new ErrorHandler("Unauthorized to modify this notification", 403).sendError(res);
    }

    const updatedNotification = await NotificationsModel.markAsRead(notificationId);

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Notification marked as read",
      data: updatedNotification,
    });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }

    await NotificationsModel.markAllAsRead(Number(userId));

    return res.status(200).json({
      success: true,
      status: 200,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark All As Read Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { notificationId } = req.params;

    if (!notificationId) {
      return new ErrorHandler("Notification ID is required", 400).sendError(res);
    }

    // Verify notification belongs to user
    const notification = await NotificationsModel.getNotificationById(notificationId);
    if (!notification) {
      return new ErrorHandler("Notification not found", 404).sendError(res);
    }

    if (Number(notification.userId) !== Number(userId)) {
      return new ErrorHandler("Unauthorized to delete this notification", 403).sendError(res);
    }

    const deletedNotification = await NotificationsModel.deleteNotification(notificationId);

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Notification deleted successfully",
      data: deletedNotification,
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

/**
 * Delete all notifications
 */
const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }

    await NotificationsModel.deleteAllNotifications(Number(userId));

    return res.status(200).json({
      success: true,
      status: 200,
      message: "All notifications deleted successfully",
    });
  } catch (error) {
    console.error("Delete All Notifications Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to delete all notifications",
      error: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};

