const {
  ConversationsModel,
  MessagesModel,
  ConversationParticipantsModel,
} = require("../models");
const ErrorHandler = require("shared/utils/errorHandler");
// Apply controller logger middleware to track all requests, responses, and errors
const { applyControllerLogger } = require("shared/middleware/controllerLogger.middleware");
// Get all conversations for the authenticated user
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role || req.user?.roles?.[0];
    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);

    const { type, archived, favorites, flagged, search, role } = req.query;

    // For project owners requesting groups: automatically filter by role='project-owner'
    // This shows only groups they created (where they have participant role='project-owner')
    let filterRole = role;
    if (!filterRole && userRole === 'project-owner' && type === 'group') {
      filterRole = 'project-owner';
      console.log(`[Get Conversations] Project owner requesting groups - filtering by role='project-owner'`);
    }

    const filters = {
      type: type || undefined,
      archived: archived === "true" ? true : archived === "false" ? false : undefined,
      favorites: favorites === "true" ? true : favorites === "false" ? false : undefined,
      flagged: flagged === "true" ? true : undefined,
      search: search || undefined,
      role: filterRole || undefined, // Filter by participant role ('project-owner' for groups created by project owner)
    };

    const conversations = await ConversationsModel.getConversationsByUser(
      Number(userId),
      filters
    );

    // Enrich conversations with user details
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Get user details for participants (requires cross-service call)
        // For now, return participant IDs and let frontend handle user display
        const participants = await ConversationParticipantsModel.getParticipantsByConversationId(conv.id);
        
        // Get other participant IDs for direct messages (frontend will fetch user details)
        let otherParticipantIds = [];
        if (conv.type === "direct" && conv.otherParticipants?.length > 0) {
          otherParticipantIds = conv.otherParticipants.map(p => p.userId);
        }

        // For group conversations, get all participant IDs
        const allParticipantIds = participants.map(p => p.userId);

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          projectId: conv.projectId,
          status: conv.status,
          isFlagged: conv.isFlagged,
          lastMessage: conv.lastMessage
            ? {
                id: conv.lastMessage.id,
                content: conv.lastMessage.content,
                senderId: conv.lastMessage.senderId,
                timestamp: conv.lastMessage.createdAt,
              }
            : null,
          participant: {
            unreadCount: conv.participant?.unreadCount || 0,
            isArchived: conv.participant?.isArchived || false,
            isFavorite: conv.participant?.isFavorite || false,
            isMuted: conv.participant?.isMuted || false,
            lastReadAt: conv.participant?.lastReadAt,
          },
          otherParticipantIds, // Array of user IDs for direct messages
          participantIds: allParticipantIds, // All participant IDs
          participants, // Full participant objects with settings
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
        };
      })
    );

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Conversations retrieved successfully",
      data: enrichedConversations,
    });
  } catch (error) {
    console.error("Get Conversations Error:", error);
    console.error("Error details:", {
      message: error.message,
      cause: error.cause?.message || error.cause,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch conversations",
      error: error.cause?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Get or create a direct conversation
const getOrCreateDirectConversation = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { otherUserId } = req.params;
    // Optional projectId from query parameter (for automatic chat creation from project service)
    const { projectId } = req.query;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!otherUserId) return new ErrorHandler("Other user ID is required", 400).sendError(res);

    if (Number(userId) === Number(otherUserId)) {
      return new ErrorHandler("Cannot create conversation with yourself", 400).sendError(res);
    }

    const conversation = await ConversationsModel.getOrCreateDirectConversation(
      Number(userId),
      Number(otherUserId),
      projectId ? Number(projectId) : null
    );

    // Get participants
    const participants = await ConversationParticipantsModel.getParticipantsByConversationId(conversation.id);

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Conversation retrieved/created successfully",
      data: {
        ...conversation,
        participants,
      },
    });
  } catch (error) {
    console.error("Get/Create Direct Conversation Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to get/create conversation",
      error: error.message,
    });
  }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    // Normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    // Verify user is a participant - use direct lookup for better reliability
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );

    if (!userParticipant) {
      // Fallback: check all participants for debugging
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(Number(conversationId));
      console.error(`[Get Messages] User ${userId} not found as participant in conversation ${conversationId}`);
      console.error(`[Get Messages] Conversation ${conversationId} has ${allParticipants.length} participants:`, 
        allParticipants.map(p => ({ userId: p.userId, role: p.role })));
      return new ErrorHandler("You are not a participant in this conversation", 403).sendError(res);
    }

    const messages = await MessagesModel.getMessages(
      Number(conversationId),
      Number(limit),
      Number(offset)
    );

    // Reverse to show oldest first (for frontend)
    const reversedMessages = messages.reverse();

    // Mark messages as read when fetching
    await MessagesModel.markAsRead(Number(conversationId), Number(userId));

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Messages retrieved successfully",
      data: reversedMessages,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: messages.length,
      },
    });
  } catch (error) {
    console.error("Get Messages Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch messages",
      error: error.message,
    });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    // Normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    const {
      conversationId,
      content,
      messageType = "text",
      fileUrl,
      fileName,
      fileSize,
      replyToId,
    } = req.body;

    if (!userId || isNaN(userId) || userId <= 0) {
      console.error(`[Send Message] Invalid userId: ${req.user?.userId || req.user?.id}`);
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);
    if (!content) return new ErrorHandler("Message content is required", 400).sendError(res);

    // Verify user is a participant - use direct lookup for better reliability
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );

    if (!userParticipant) {
      // Fallback: check all participants for debugging
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(Number(conversationId));
      console.error(`[Send Message] User ${userId} not found as participant in conversation ${conversationId}`);
      console.error(`[Send Message] Conversation ${conversationId} has ${allParticipants.length} participants:`, 
        allParticipants.map(p => ({ userId: p.userId, role: p.role })));
      return new ErrorHandler("You are not a participant in this conversation", 403).sendError(res);
    }

    // Check if conversation is flagged and user is not admin
    const conversation = await ConversationsModel.getConversationById(Number(conversationId));
    if (conversation?.isFlagged && req.user?.role !== "admin") {
      return new ErrorHandler("Cannot send messages to flagged conversations", 403).sendError(res);
    }

    const message = await MessagesModel.createMessage({
      conversationId: Number(conversationId),
      senderId: Number(userId),
      content,
      messageType,
      fileUrl,
      fileName,
      fileSize,
      replyToId: replyToId ? Number(replyToId) : null,
    });

    // Emit Socket.io event for real-time message delivery
    if (global.io && global.socketHandlers) {
      await global.socketHandlers.emitToConversation(
        Number(conversationId),
        "new_message",
        {
          conversationId: Number(conversationId),
          message,
        }
      );
    }

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to send message",
      error: error.message,
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { conversationId } = req.params;
    const { messageIds } = req.body || {};

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    await MessagesModel.markAsRead(Number(conversationId), Number(userId), messageIds);

    // Emit Socket.io event for real-time read receipts
    if (global.io && global.socketHandlers) {
      await global.socketHandlers.emitToConversation(
        Number(conversationId),
        "messages_read",
        {
          conversationId: Number(conversationId),
          userId: Number(userId),
          messageIds: messageIds || [],
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Mark as Read Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to mark messages as read",
      error: error.message,
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { messageId } = req.params;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!messageId) return new ErrorHandler("Message ID is required", 400).sendError(res);

    // Validate messageId is a valid number
    const parsedMessageId = Number(messageId);
    if (isNaN(parsedMessageId) || parsedMessageId <= 0) {
      return new ErrorHandler("Invalid message ID", 400).sendError(res);
    }

    const message = await MessagesModel.deleteMessage(parsedMessageId, Number(userId));

    if (!message) {
      return new ErrorHandler("Message not found or you don't have permission", 404).sendError(res);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Message deleted successfully",
      data: message,
    });
  } catch (error) {
    console.error("Delete Message Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to delete message",
      error: error.message,
    });
  }
};

// Edit message
const editMessage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!messageId) return new ErrorHandler("Message ID is required", 400).sendError(res);
    if (!content) return new ErrorHandler("Content is required", 400).sendError(res);

    const message = await MessagesModel.editMessage(
      Number(messageId),
      Number(userId),
      content
    );

    if (!message) {
      return new ErrorHandler("Message not found or you don't have permission", 404).sendError(res);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Message edited successfully",
      data: message,
    });
  } catch (error) {
    console.error("Edit Message Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to edit message",
      error: error.message,
    });
  }
};

// Create group conversation (only project-owners can create, and only developers can be added)
const createGroupConversation = async (req, res) => {
  try {
    // Extract and normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    
    const userRole = req.user?.role || req.user?.roles?.[0];
    const { name, projectId, participantIds } = req.body;

    if (!userId || isNaN(userId) || userId <= 0) {
      console.error(`[Create Group] Invalid userId: ${req.user?.userId || req.user?.id}`);
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }
    
    if (!name) return new ErrorHandler("Group name is required", 400).sendError(res);

    // Verify user is project-owner (route middleware should handle this, but double-check)
    if (userRole !== "project-owner") {
      return new ErrorHandler("Only project owners can create group conversations", 403).sendError(res);
    }

    console.log(`[Create Group] Creating group for user ${userId} (type: ${typeof userId}), role: ${userRole}`);

    // Note: participantIds should only contain developer IDs
    // In a microservices architecture, you would verify each participantId is a developer
    // by calling the user-service. For now, we'll trust the frontend sends only developer IDs.

    const conversation = await ConversationsModel.createConversation({
      type: "group",
      name,
      projectId: projectId ? Number(projectId) : null,
      createdBy: userId, // Already normalized to number
      creatorRole: userRole, // Pass user role so model can set participant role correctly
    });

    // Add all participants (should be developers only)
    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        // Add as developer (developers have 'developer' role, creator has 'project-owner' role)
        await ConversationParticipantsModel.addParticipant(
          conversation.id, 
          Number(participantId),
          "developer"
        );
      }
    }

        // Creator (project-owner) is already added in createConversation
    // Use a retry mechanism to verify participant is queryable (handles transaction commit timing)
    // DO NOT add the creator again - it's already added in createConversation
    let creatorParticipant = null;
    let retries = 5;
    let retryDelay = 200; // Start with 200ms
    
    while (!creatorParticipant && retries > 0) {
      creatorParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
        conversation.id,
        userId
      );
      
      if (!creatorParticipant) {
        retries--;
        if (retries > 0) {
          console.log(`[Create Group] Creator participant not found yet, retrying in ${retryDelay}ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 1.5; // Exponential backoff
        }
      }
    }
    
    // Only verify - do not add again since it's already added in createConversation
    if (creatorParticipant) {
      // Ensure role is 'project-owner' for project owners (in case it was set incorrectly)
      if (userRole === "project-owner" && creatorParticipant.role !== "project-owner") {
        console.log(`[Create Group] Updating creator role to project-owner...`);
      await ConversationParticipantsModel.updateParticipant(conversation.id, userId, {
          role: "project-owner",
      });
      creatorParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
        conversation.id,
        userId
      );
    }
    
      console.log(`[Create Group] ✅ Group ${conversation.id} created by user ${userId} (verified as ${creatorParticipant.role})`);
    } else {
      console.warn(`[Create Group] ⚠️ Creator ${userId} not found after retries, but participant should have been added in createConversation`);
      console.warn(`[Create Group] This might indicate a database transaction issue. Participant should appear shortly.`);
      // Get all participants for debugging
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(conversation.id);
      console.log(`[Create Group] Current participants in group ${conversation.id}:`, 
        allParticipants.map(p => ({ userId: p.userId, role: p.role })));
      // Don't throw an error - the participant was added in createConversation, it should be available soon
    }

    // Send welcome message automatically from project-owner to all developers
    // This is wrapped in a try-catch and non-blocking - group creation will succeed even if this fails
    try {
      // Get all developer participants (excluding the project-owner)
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(conversation.id);
      const developerParticipants = allParticipants.filter(p => p.role === 'developer');
      
      // Only send welcome message if there are developers
      if (developerParticipants.length > 0) {
        // Create welcome message content
        let welcomeMessage = `👋 Welcome to the "${name}" group chat!\n\n`;
        
        if (projectId) {
          welcomeMessage += `This chat is for the **${name}** project. `;
        }
        
        welcomeMessage += `I'm excited to work with you all on this project. `;
        welcomeMessage += `Feel free to introduce yourselves and ask any questions you may have.\n\n`;
        welcomeMessage += `Let's make this project a success! 🚀`;

        // Send the welcome message
        const welcomeMsg = await MessagesModel.createMessage({
          conversationId: conversation.id,
          senderId: userId, // Send from project-owner
          content: welcomeMessage,
          messageType: "text",
        });

        console.log(`[Create Group] ✅ Welcome message sent to group ${conversation.id} from project-owner ${userId}`);

        // Emit Socket.io event for real-time message delivery (non-blocking)
        if (global.io && global.socketHandlers) {
          try {
            await global.socketHandlers.emitToConversation(
              conversation.id,
              "new_message",
              {
                conversationId: conversation.id,
                message: welcomeMsg,
              }
            );
          } catch (socketError) {
            // Socket.io errors should not break the flow
            console.error(`[Create Group] Socket.io emit error (non-critical):`, socketError);
          }
        }
      }
    } catch (welcomeError) {
      // Log error but don't fail the group creation
      console.error(`[Create Group] ⚠️ Failed to send welcome message (non-critical):`, welcomeError);
      // Don't throw - group was created successfully, welcome message is just a bonus
    }

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Group conversation created successfully",
      data: conversation,
    });
  } catch (error) {
    console.error("Create Group Conversation Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to create group conversation",
      error: error.message,
    });
  }
};

// Update conversation participant settings (archive, favorite, mute)
const updateParticipantSettings = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { conversationId } = req.params;
    const { isArchived, isFavorite, isMuted } = req.body;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    const updates = {};
    if (isArchived !== undefined) updates.isArchived = isArchived;
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;
    if (isMuted !== undefined) updates.isMuted = isMuted;

    if (Object.keys(updates).length === 0) {
      return new ErrorHandler("No updates provided", 400).sendError(res);
    }

    const participant = await ConversationParticipantsModel.updateParticipant(
      Number(conversationId),
      Number(userId),
      updates
    );

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Participant settings updated successfully",
      data: participant,
    });
  } catch (error) {
    console.error("Update Participant Settings Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to update participant settings",
      error: error.message,
    });
  }
};

// Flag conversation (admin only)
const flagConversation = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { conversationId } = req.params;
    const { reason } = req.body;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    // Validate conversationId is a valid number
    const parsedConversationId = Number(conversationId);
    if (isNaN(parsedConversationId) || parsedConversationId <= 0) {
      return new ErrorHandler("Invalid conversation ID", 400).sendError(res);
    }

    const conversation = await ConversationsModel.flagConversation(
      parsedConversationId,
      Number(userId),
      reason || null
    );

    if (!conversation) {
      return new ErrorHandler("Conversation not found", 404).sendError(res);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Conversation flagged successfully",
      data: conversation,
    });
  } catch (error) {
    console.error("Flag Conversation Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to flag conversation",
      error: error.message,
    });
  }
};

// Unflag conversation (admin only)
const unflagConversation = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { conversationId } = req.params;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    // Validate conversationId is a valid number
    const parsedConversationId = Number(conversationId);
    if (isNaN(parsedConversationId) || parsedConversationId <= 0) {
      return new ErrorHandler("Invalid conversation ID", 400).sendError(res);
    }

    const conversation = await ConversationsModel.unflagConversation(parsedConversationId);

    if (!conversation) {
      return new ErrorHandler("Conversation not found", 404).sendError(res);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Conversation unflagged successfully",
      data: conversation,
    });
  } catch (error) {
    console.error("Unflag Conversation Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to unflag conversation",
      error: error.message,
    });
  }
};

// Add participants to a group conversation (only project-owners can add, only developers can be added)
const addParticipantsToGroup = async (req, res) => {
  try {
    // Normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    
    const userRole = req.user?.role || req.user?.roles?.[0];
    const { conversationId } = req.params;
    const { participantIds } = req.body;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return new ErrorHandler("Participant IDs array is required", 400).sendError(res);
    }

    // Verify user is project-owner
    if (userRole !== "project-owner") {
      return new ErrorHandler("Only project owners can add participants to groups", 403).sendError(res);
    }

    // Verify conversation exists and is a group
    const conversation = await ConversationsModel.getConversationById(Number(conversationId));
    if (!conversation) {
      return new ErrorHandler("Conversation not found", 404).sendError(res);
    }
    if (conversation.type !== "group") {
      return new ErrorHandler("Participants can only be added to group conversations", 400).sendError(res);
    }

    // Verify user is an admin/creator of this group
    // First, get all participants to debug
    const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(Number(conversationId));
    console.log(`[Add Participants] Conversation ${conversationId} has ${allParticipants.length} participants:`, 
      allParticipants.map(p => ({ userId: p.userId, role: p.role })));
    console.log(`[Add Participants] Looking for user ${userId} in conversation ${conversationId}`);
    
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );
    
    console.log(`[Add Participants] User ${userId} participant check:`, {
      found: !!userParticipant,
      role: userParticipant?.role,
      participantUserId: userParticipant?.userId,
      requestedUserId: Number(userId),
      conversationId: Number(conversationId)
    });
    
    if (!userParticipant) {
      console.error(`[Add Participants] ❌ User ${userId} not found in conversation ${conversationId}`);
      return new ErrorHandler("You are not a participant in this group", 403).sendError(res);
    }
    
    if (userParticipant.role !== "project-owner") {
      console.error(`[Add Participants] ❌ User ${userId} is not project-owner (role: ${userParticipant.role})`);
      return new ErrorHandler("Only group creators (project-owners) can add participants", 403).sendError(res);
    }
    
    console.log(`[Add Participants] ✅ User ${userId} verified as project-owner`);

    // Add all participants (should be developers only)
    const addedParticipants = [];
    const errors = [];
    
    for (const participantId of participantIds) {
      try {
        // Check if participant already exists
        const existingParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
          Number(conversationId),
          Number(participantId)
        );
        
        if (existingParticipant && !existingParticipant.leftAt) {
          errors.push(`User ${participantId} is already a participant`);
          continue;
        }

        // Add participant as developer (developers have 'developer' role)
        const participant = await ConversationParticipantsModel.addParticipant(
          Number(conversationId),
          Number(participantId),
          "developer"
        );
        addedParticipants.push(participant);
      } catch (error) {
        console.error(`Error adding participant ${participantId}:`, error);
        errors.push(`Failed to add user ${participantId}: ${error.message}`);
      }
    }

    // Emit Socket.io event to notify new participants
    if (global.io && global.socketHandlers && addedParticipants.length > 0) {
      await global.socketHandlers.emitToConversation(
        Number(conversationId),
        "participants_added",
        {
          conversationId: Number(conversationId),
          participantIds: addedParticipants.map(p => p.userId),
          addedBy: Number(userId),
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Added ${addedParticipants.length} participant(s) to group`,
      data: {
        added: addedParticipants,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Add Participants Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to add participants",
      error: error.message,
    });
  }
};

// Remove participant from group (only project-owners can remove)
const removeParticipantFromGroup = async (req, res) => {
  try {
    // Normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    
    const userRole = req.user?.role || req.user?.roles?.[0];
    const { conversationId, participantId } = req.params;

    if (!userId || isNaN(userId) || userId <= 0) {
      console.error(`[Remove Participant] Invalid userId: ${req.user?.userId || req.user?.id}`);
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);
    if (!participantId) return new ErrorHandler("Participant ID is required", 400).sendError(res);

    // Verify user is project-owner
    if (userRole !== "project-owner") {
      return new ErrorHandler("Only project owners can remove participants from groups", 403).sendError(res);
    }

    // Verify conversation exists and is a group
    const conversation = await ConversationsModel.getConversationById(Number(conversationId));
    if (!conversation) {
      return new ErrorHandler("Conversation not found", 404).sendError(res);
    }
    if (conversation.type !== "group") {
      return new ErrorHandler("Participants can only be removed from group conversations", 400).sendError(res);
    }

    // Verify user is an admin/creator of this group
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );
    
    if (!userParticipant) {
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(Number(conversationId));
      console.error(`[Remove Participant] User ${userId} not found in conversation ${conversationId}`);
      console.error(`[Remove Participant] Conversation ${conversationId} has ${allParticipants.length} participants:`, 
        allParticipants.map(p => ({ userId: p.userId, role: p.role })));
      return new ErrorHandler("You are not a participant in this group", 403).sendError(res);
    }
    
    if (userParticipant.role !== "project-owner") {
      console.error(`[Remove Participant] User ${userId} is not project-owner (role: ${userParticipant.role})`);
      return new ErrorHandler("Only group creators (project-owners) can remove participants", 403).sendError(res);
    }
    
    console.log(`[Remove Participant] ✅ User ${userId} verified as project-owner`);

    // Cannot remove yourself (project-owner)
    if (Number(participantId) === Number(userId)) {
      return new ErrorHandler("Cannot remove yourself from the group", 400).sendError(res);
    }

    // Remove participant
    await ConversationParticipantsModel.removeParticipant(
      Number(conversationId),
      Number(participantId)
    );

    // Emit Socket.io event
    if (global.io && global.socketHandlers) {
      await global.socketHandlers.emitToConversation(
        Number(conversationId),
        "participant_removed",
        {
          conversationId: Number(conversationId),
          participantId: Number(participantId),
          removedBy: Number(userId),
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Participant removed from group successfully",
    });
  } catch (error) {
    console.error("Remove Participant Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to remove participant",
      error: error.message,
    });
  }
};

// Get participants of a conversation
const getConversationParticipants = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { conversationId } = req.params;

    if (!userId) return new ErrorHandler("User ID is required", 400).sendError(res);
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    // Verify user is a participant in this conversation
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );

    if (!userParticipant) {
      return new ErrorHandler("You are not a participant in this conversation", 403).sendError(res);
    }

    // Get all participants
    const participants = await ConversationParticipantsModel.getParticipantsByConversationId(
      Number(conversationId)
    );

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Participants retrieved successfully",
      data: participants,
    });
  } catch (error) {
    console.error("Get Participants Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to retrieve participants",
      error: error.message,
    });
  }
};

// Delete conversation (group or direct)
// - For groups: Only project owners who created the group can delete
// - For direct: Only the developer who started the conversation can delete
const deleteGroupConversation = async (req, res) => {
  try {
    // Normalize userId - handle both string and number from JWT
    let userId = req.user?.userId || req.user?.id;
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10);
    } else {
      userId = Number(userId);
    }
    
    const userRole = req.user?.role || req.user?.roles?.[0];
    const { conversationId } = req.params;

    if (!userId || isNaN(userId) || userId <= 0) {
      console.error(`[Delete Conversation] Invalid userId: ${req.user?.userId || req.user?.id}`);
      return new ErrorHandler("User ID is required", 400).sendError(res);
    }
    if (!conversationId) return new ErrorHandler("Conversation ID is required", 400).sendError(res);

    // Verify conversation exists
    const conversation = await ConversationsModel.getConversationById(Number(conversationId));
    if (!conversation) {
      return new ErrorHandler("Conversation not found", 404).sendError(res);
    }
    if (conversation.status === "deleted") {
      return new ErrorHandler("Conversation is already deleted", 400).sendError(res);
    }

    // Verify user is a participant
    const userParticipant = await ConversationParticipantsModel.getParticipantByConversationAndUser(
      Number(conversationId),
      Number(userId)
    );
    
    if (!userParticipant) {
      return new ErrorHandler("You are not a participant in this conversation", 403).sendError(res);
    }

    // Check conversation type and verify permissions
    if (conversation.type === "group") {
      // For groups: Only project owners who created the group can delete
      if (userRole !== "project-owner") {
        return new ErrorHandler("Only project owners can delete group conversations", 403).sendError(res);
      }
      
      if (userParticipant.role !== "project-owner") {
        console.error(`[Delete Conversation] User ${userId} is not project-owner (role: ${userParticipant.role})`);
        return new ErrorHandler("Only group creators (project-owners) can delete the group", 403).sendError(res);
      }
      
      console.log(`[Delete Conversation] ✅ User ${userId} verified as project-owner and group creator`);
    } else if (conversation.type === "direct") {
      // For direct conversations: Only the developer who started the conversation can delete
      // The initiator is the participant with the earliest joinedAt timestamp
      const allParticipants = await ConversationParticipantsModel.getParticipantsByConversationId(Number(conversationId));
      
      if (allParticipants.length < 2) {
        return new ErrorHandler("Invalid direct conversation", 400).sendError(res);
      }

      // Find the participant with the earliest joinedAt (the initiator)
      const sortedParticipants = allParticipants.sort((a, b) => {
        const dateA = new Date(a.joinedAt || a.createdAt);
        const dateB = new Date(b.joinedAt || b.createdAt);
        return dateA - dateB;
      });
      
      const initiator = sortedParticipants[0];
      
      if (Number(initiator.userId) !== Number(userId)) {
        console.error(`[Delete Conversation] User ${userId} is not the initiator (initiator: ${initiator.userId})`);
        return new ErrorHandler("Only the person who started this conversation can delete it", 403).sendError(res);
      }

      // Only developers can delete direct conversations they started
      if (userRole !== "developer") {
        return new ErrorHandler("Only developers can delete direct conversations they started", 403).sendError(res);
      }
      
      console.log(`[Delete Conversation] ✅ User ${userId} verified as developer and direct conversation initiator`);
    } else {
      return new ErrorHandler("This conversation type cannot be deleted", 400).sendError(res);
    }

    // Soft delete the conversation (set status to 'deleted')
    const deletedConversation = await ConversationsModel.deleteConversation(Number(conversationId));

    // Emit Socket.io event to notify all participants
    if (global.io && global.socketHandlers) {
      await global.socketHandlers.emitToConversation(
        Number(conversationId),
        "conversation_deleted",
        {
          conversationId: Number(conversationId),
          deletedBy: Number(userId),
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Conversation deleted successfully",
      data: deletedConversation,
    });
  } catch (error) {
    console.error("Delete Conversation Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to delete conversation",
      error: error.message,
    });
  }
};

const controllers = {
  getConversations,
  getOrCreateDirectConversation,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  createGroupConversation,
  addParticipantsToGroup,
  removeParticipantFromGroup,
  getConversationParticipants,
  updateParticipantSettings,
  flagConversation,
  unflagConversation,
  deleteGroupConversation,
};


module.exports = applyControllerLogger(controllers);

