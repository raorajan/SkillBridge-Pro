require("dotenv").config();

/**
 * External API URLs Configuration
 * All external API URLs are loaded from environment variables with fallback defaults
 */
const API_GATEWAY_BASE_URL = process.env.API_GATEWAY_BASE_URL || process.env.API_GATEWAY_URL || "http://localhost:3000";

const API_URLS = {
  // API Gateway Base URL (for OAuth callbacks)
  API_GATEWAY_BASE_URL,

  // GitHub API URLs
  GITHUB_API_BASE_URL: process.env.GITHUB_API_BASE_URL || "https://api.github.com",
  GITHUB_WEB_BASE_URL: process.env.GITHUB_WEB_BASE_URL || "https://github.com",

  // StackOverflow API URLs
  STACKOVERFLOW_API_BASE_URL:
    process.env.STACKOVERFLOW_API_BASE_URL || "https://api.stackexchange.com/2.3",
  STACKOVERFLOW_SITE: process.env.STACKOVERFLOW_SITE || "stackoverflow",

  // OAuth Callback URLs
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    `${API_GATEWAY_BASE_URL}/api/v1/auth/google/callback`,
  GITHUB_CALLBACK_URL:
    process.env.GITHUB_CALLBACK_URL ||
    `${API_GATEWAY_BASE_URL}/api/v1/auth/github/callback`,
  LINKEDIN_CALLBACK_URL:
    process.env.LINKEDIN_CALLBACK_URL ||
    `${API_GATEWAY_BASE_URL}/api/v1/auth/linkedin/callback`,
};

module.exports = API_URLS;

