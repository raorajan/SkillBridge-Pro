const express = require("express");
const passport = require("passport");
const authRouter = express.Router();

const CLIENT_URL = process.env.CLIENT_URL;

// 🌐 Google OAuth
authRouter.get(
  "/google",
  (req, res, next) => {
    // Store redirect_to in session for callback
    if (req.query.redirect_to) {
      req.session.redirect_to = req.query.redirect_to;
    }
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${CLIENT_URL}/auth` }),
  (req, res) => {
    // Get redirect URL from session or default to dashboard
    const redirectUrl = req.session.redirect_to ? 
      `${CLIENT_URL}${decodeURIComponent(req.session.redirect_to)}` : 
      `${CLIENT_URL}/dashboard`;
    
    // Clear the redirect from session
    delete req.session.redirect_to;
    
    res.redirect(redirectUrl);
  }
);

// 🐱 GitHub OAuth
authRouter.get(
  "/github",
  (req, res, next) => {
    // Store redirect_to in session for callback
    if (req.query.redirect_to) {
      req.session.redirect_to = req.query.redirect_to;
    }
    next();
  },
  passport.authenticate("github", { scope: ["user:email"] })
);

authRouter.get(
  "/github/callback",
  // Unified callback handler - routes to portfolio sync or regular auth
  async (req, res, next) => {
    // Check if this is a portfolio sync OAuth flow
    if (req.session?.portfolioSyncUserId) {
      // Route to portfolio sync handler - don't serialize user for portfolio sync
      return passport.authenticate("github-portfolio-sync", {
        failureRedirect: `${process.env.CLIENT_URL || process.env.CLIENT_URL || CLIENT_URL}/portfolio-sync?error=github_connection_failed`,
        session: false, // Don't create a session for portfolio sync
      })(req, res, (err) => {
        if (err) {
          console.error("Portfolio sync OAuth error:", err);
          const clientUrl = process.env.CLIENT_URL || process.env.CLIENT_URL || CLIENT_URL;
          return res.redirect(`${clientUrl}/portfolio-sync?error=github_connection_failed`);
        }
        // Success - tokens are already stored in database by the passport strategy
        // Clear the session flag
        delete req.session.portfolioSyncUserId;
        const clientUrl = process.env.CLIENT_URL || process.env.CLIENT_URL || CLIENT_URL;
        const redirectUrl = `${clientUrl}/portfolio-sync?status=github_connected`;
        res.redirect(redirectUrl);
      });
    }
    // Otherwise, use regular auth handler
    next();
  },
  passport.authenticate("github", { failureRedirect: `${CLIENT_URL}/auth` }),
  (req, res) => {
    // Get redirect URL from session or default to dashboard
    const redirectUrl = req.session.redirect_to ? 
      `${CLIENT_URL}${decodeURIComponent(req.session.redirect_to)}` : 
      `${CLIENT_URL}/dashboard`;
    
    // Clear the redirect from session
    delete req.session.redirect_to;
    
    res.redirect(redirectUrl);
  }
);

// 💼 LinkedIn OAuth
authRouter.get(
  "/linkedin",
  (req, res, next) => {
    // Store redirect_to in session for callback
    if (req.query.redirect_to) {
      req.session.redirect_to = req.query.redirect_to;
    }
    next();
  },
  passport.authenticate("linkedin")
);

authRouter.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", {
    failureRedirect: `${CLIENT_URL}/auth`,
  }),
  (req, res) => {
    // Get redirect URL from session or default to dashboard
    const redirectUrl = req.session.redirect_to ? 
      `${CLIENT_URL}${decodeURIComponent(req.session.redirect_to)}` : 
      `${CLIENT_URL}/dashboard`;
    
    // Clear the redirect from session
    delete req.session.redirect_to;
    
    res.redirect(redirectUrl);
  }
);

module.exports = authRouter;
