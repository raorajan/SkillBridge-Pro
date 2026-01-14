const axios = require("axios");

/**
 * Chat Service Client
 * Utility to communicate with the chat-service through the API Gateway
 * 
 * This client handles creating direct conversations between project owners and developers
 * when developers are shortlisted or accepted to a project.
 */

// Get API Gateway URL from environment or use default
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || process.env.API_GATEWAY_BASE_URL || process.env.BACKEND_URL ;
const CHAT_SERVICE_BASE_URL = `${API_GATEWAY_URL}/api/v1/chat`;

/**
 * Create or get a direct conversation between two users
 * This is idempotent - if conversation exists, it returns the existing one
 * 
 * @param {number} userId1 - First user ID (project owner)
 * @param {number} userId2 - Second user ID (developer)
 * @param {number|null} projectId - Optional project ID to associate with conversation
 * @param {string|null} authToken - Optional auth token (if not provided, won't authenticate)
 * @returns {Promise<Object|null>} - Conversation object or null if failed
 */
const createOrGetDirectConversation = async (userId1, userId2, projectId = null, authToken = null) => {
  try {
    if (!userId1 || !userId2) {
      console.error("[ChatServiceClient] Missing required user IDs:", { userId1, userId2 });
      return null;
    }

    // Use the getOrCreateDirectConversation endpoint (it's idempotent)
    // The endpoint is: GET /api/v1/chat/conversations/direct/:otherUserId?projectId=xxx
    let url = `${CHAT_SERVICE_BASE_URL}/conversations/direct/${userId2}`;
    if (projectId) {
      url += `?projectId=${projectId}`;
    }
    
    const headers = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await axios.get(url, {
      headers,
      timeout: 10000, // 10 second timeout
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    if (response.status === 200 && response.data?.success) {
      const conversation = response.data.data;
      
      // If projectId is provided and conversation doesn't have it, we could update it
      // But for now, we'll just return the conversation as-is
      // The projectId association is optional in the chat service
      
      console.log(`[ChatServiceClient] ✅ Successfully created/retrieved conversation ${conversation.id} between ${userId1} and ${userId2}`);
      return conversation;
    } else {
      console.error(`[ChatServiceClient] Failed to create conversation:`, {
        status: response.status,
        data: response.data,
      });
      return null;
    }
  } catch (error) {
    // Log error but don't throw - this is a non-blocking operation
    console.error("[ChatServiceClient] Error creating/retrieving conversation:", {
      error: error.message,
      userId1,
      userId2,
      projectId,
      response: error.response?.data,
    });
    return null;
  }
};

/**
 * Create a group conversation (for project owners)
 * 
 * @param {number} projectOwnerId - Project owner user ID
 * @param {string} groupName - Name of the group chat
 * @param {number|null} projectId - Project ID to associate with group
 * @param {Array<number>} participantIds - Array of developer user IDs to add
 * @param {string|null} authToken - Auth token for project owner
 * @returns {Promise<Object|null>} - Group conversation object or null if failed
 */
const createGroupConversation = async (projectOwnerId, groupName, projectId = null, participantIds = [], authToken = null) => {
  try {
    if (!projectOwnerId || !groupName) {
      console.error("[ChatServiceClient] Missing required parameters for group creation:", {
        projectOwnerId,
        groupName,
      });
      return null;
    }

    const url = `${CHAT_SERVICE_BASE_URL}/conversations/group`;
    
    const headers = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const requestBody = {
      name: groupName,
      projectId: projectId || null,
      participantIds: Array.isArray(participantIds) ? participantIds : [],
    };

    const response = await axios.post(url, requestBody, {
      headers,
      timeout: 15000, // 15 second timeout for group creation
      validateStatus: (status) => status < 500,
    });

    if (response.status === 201 && response.data?.success) {
      const conversation = response.data.data;
      console.log(`[ChatServiceClient] ✅ Successfully created group conversation ${conversation.id}: "${groupName}"`);
      return conversation;
    } else {
      console.error(`[ChatServiceClient] Failed to create group conversation:`, {
        status: response.status,
        data: response.data,
      });
      return null;
    }
  } catch (error) {
    console.error("[ChatServiceClient] Error creating group conversation:", {
      error: error.message,
      projectOwnerId,
      groupName,
      projectId,
      participantIds,
      response: error.response?.data,
    });
    return null;
  }
};

/**
 * Helper function to extract auth token from request object
 * @param {Object} req - Express request object
 * @returns {string|null} - Auth token or null
 */
const extractAuthToken = (req) => {
  if (!req || !req.headers) return null;
  
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  return null;
};

module.exports = {
  createOrGetDirectConversation,
  createGroupConversation,
  extractAuthToken,
};

