const HttpException = require("shared/utils/HttpException.utils");
const {
  UserNotificationSettingsModel,
  UserNotificationFrequencyModel,
  UserQuietHoursModel,
  UserPrivacySettingsModel,
  UserIntegrationsModel,
  UserSubscriptionsModel,
} = require("../models");

const resolveUserId = (req) => {
  // Use authenticated user ID from JWT token
  if (req.user?.userId) {
    const userId = Number(req.user.userId);
    if (!isNaN(userId) && userId > 0) return userId;
  }
  if (req.user?.id) {
    const userId = Number(req.user.id);
    if (!isNaN(userId) && userId > 0) return userId;
  }
  // Fallback to headers/query for backward compatibility
  if (req.headers["x-user-id"]) {
    const userId = Number(req.headers["x-user-id"]);
    if (!isNaN(userId) && userId > 0) return userId;
  }
  if (req.query.userId) {
    const userId = Number(req.query.userId);
    if (!isNaN(userId) && userId > 0) return userId;
  }
  return null;
};

// ---------- Notification Settings (toggles)
async function getNotificationSettings(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserNotificationSettingsModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertNotificationSettings(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    
    // Validate payload is an object
    if (typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpException(400, "Invalid payload format");
    }
    
    const row = await UserNotificationSettingsModel.upsertByUserId(userId, payload);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// ---------- Notification Frequency
async function getNotificationFrequency(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserNotificationFrequencyModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertNotificationFrequency(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    const row = await UserNotificationFrequencyModel.upsertByUserId(userId, payload);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// ---------- Quiet Hours
async function getQuietHours(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserQuietHoursModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertQuietHours(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    const row = await UserQuietHoursModel.upsertByUserId(userId, payload);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// ---------- Privacy
async function getPrivacySettings(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserPrivacySettingsModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertPrivacySettings(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    const row = await UserPrivacySettingsModel.upsertByUserId(userId, payload);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// ---------- Integrations
async function getIntegrations(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserIntegrationsModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertIntegrations(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    const now = new Date();

    // Auto-populate connectedAt timestamps on boolean connect/disconnect changes
    const existing = await UserIntegrationsModel.getByUserId(userId);
    const computed = {};
    
    // Handle nested object structure (e.g., { github: { enabled: true } }) or flat structure (e.g., { github: true })
    const integrationFields = [
      'github', 'linkedin', 'googleCalendar', 'slack', 'discord', 'trello', 'asana'
    ];
    
    integrationFields.forEach(field => {
      // Handle both nested and flat structures
      let value = payload[field];
      if (value && typeof value === 'object' && value.enabled !== undefined) {
        value = value.enabled;
      }
      
      if (value !== undefined) {
        computed[field] = Boolean(value);
        // Update connectedAt timestamp if status changed
        if (!existing || existing[field] !== computed[field]) {
          const connectedAtField = `${field}ConnectedAt`;
          computed[connectedAtField] = computed[field] ? now : null;
        }
      }
    });

    // If no valid fields were provided, return error
    if (Object.keys(computed).length === 0) {
      throw new HttpException(400, "No valid integration fields provided");
    }

    const row = await UserIntegrationsModel.upsertByUserId(userId, computed);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// ---------- Subscription (as surfaced in Settings)
async function getSubscription(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const row = await UserSubscriptionsModel.getByUserId(userId);
    res.json({ success: true, data: row || null });
  } catch (err) {
    next(err);
  }
}

async function upsertSubscription(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) throw new HttpException(400, "userId is required");
    const payload = req.body || {};
    
    // Validate payload is an object
    if (typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpException(400, "Invalid payload format");
    }
    
    // Validate plan if provided
    if (payload.plan && typeof payload.plan !== 'string') {
      throw new HttpException(400, "Plan must be a string");
    }
    
    const row = await UserSubscriptionsModel.upsertByUserId(userId, payload);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotificationSettings,
  upsertNotificationSettings,
  getNotificationFrequency,
  upsertNotificationFrequency,
  getQuietHours,
  upsertQuietHours,
  getPrivacySettings,
  upsertPrivacySettings,
  getIntegrations,
  upsertIntegrations,
  getSubscription,
  upsertSubscription,
};


