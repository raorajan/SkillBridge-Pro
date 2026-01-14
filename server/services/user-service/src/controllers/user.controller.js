const { UserModel } = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail } = require("shared/utils/sendEmail");
const ErrorHandler = require("shared/utils/errorHandler");
const { uploadFileToSupabase } = require("shared/utils/uploadFile.utils");
const { supabase } = require("shared/utils/supabase.utils");
require("dotenv").config();

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      domains,
      experience,
      availability,
      password,
      adminKey,
      company,
      location,
      website,
      businessType,
    } = req.body;

    // Basic validation - required for all roles
    if (!name || !email || !role || !password) {
      return new ErrorHandler(
        "Name, email, role, and password are required",
        400
      ).sendError(res);
    }

    // Role-specific validation
    if (role === "developer") {
      if (
        !domains ||
        experience === undefined ||
        experience === null ||
        !availability
      ) {
        return new ErrorHandler(
          "For developers, domains, experience, and availability are required",
          400
        ).sendError(res);
      }
    } else if (role === "admin") {
      // Validate admin key if provided
      if (adminKey) {
        const validAdminKey = process.env.ADMIN_REGISTRATION_KEY;
        if (adminKey !== validAdminKey) {
          return new ErrorHandler(
            "Invalid admin registration key",
            403
          ).sendError(res);
        }
      } else {
        return new ErrorHandler(
          "Admin registration requires an admin key",
          400
        ).sendError(res);
      }
    }

    // Validate role
    const validRoles = ["developer", "project-owner", "admin"];
    if (!validRoles.includes(role)) {
      return new ErrorHandler(
        "Invalid role. Must be one of: developer, project-owner, admin",
        400
      ).sendError(res);
    }

    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return new ErrorHandler("User already exists", 409).sendError(res);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    // Hash the token before storing (same as password reset flow)
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // Prepare user data with role-specific defaults
    const userData = {
      name,
      email,
      role, // Keep for backward compatibility
      password: hashedPassword,
      isEmailVerified: false,
      resetPasswordToken: hashedVerificationToken,
      resetPasswordExpire: new Date(Date.now() + 15 * 60 * 1000),
    };

    // Add role-specific fields
    if (role === "developer") {
      userData.domainPreferences = domains;
      userData.experience = experience.toString();
      userData.availability = availability;
      if (location) userData.location = location;
    } else if (role === "project-owner") {
      // For project owners, use company as domain preference or default
      userData.domainPreferences = company || domains || "N/A";
      userData.experience = "0";
      userData.availability = availability || "full-time";
      if (location) userData.location = location;
      // Store additional project owner info in bio or a custom field
      if (company)
        userData.bio = `Company: ${company}${
          website ? `\nWebsite: ${website}` : ""
        }${businessType ? `\nBusiness Type: ${businessType}` : ""}`;
    } else if (role === "admin") {
      // For admins, set defaults
      userData.domainPreferences = "N/A";
      userData.experience = "0";
      userData.availability = "full-time";
    }

    const user = await UserModel.createUser(userData);

    // Assign the initial role to the user
    await UserModel.assignRole(user.id, role);

    // Auto-verify test emails (emails containing "test_" or ending with "@example.com")
    const isTestEmail =
      email.includes("test_") || email.endsWith("@example.com");
    if (
      isTestEmail &&
      (process.env.NODE_ENV !== "production" ||
        process.env.AUTO_VERIFY_TEST_EMAILS === "true")
    ) {
      await UserModel.updateUser(user.id, {
        isEmailVerified: true,
        resetPasswordToken: null,
        resetPasswordExpire: null,
      });
      user.isEmailVerified = true;
    }

    const verifyEmailBaseUrl =
      process.env.VERIFY_EMAIL_URL || process.env.CLIENT_URL + "/verify-email";
    const verificationUrl = `${verifyEmailBaseUrl}?token=${verificationToken}`;

    // Role-specific email template generator
    const getRoleSpecificSignupEmail = (
      role,
      name,
      userEmail,
      verificationUrl
    ) => {
      const templates = {
        developer: {
          gradient: "135deg, #3b82f6 0%, #8b5cf6 100%",
          emoji: "👨‍💻",
          title: "Welcome Developer!",
          greeting: `Hello ${name},`,
          message:
            "Thank you for joining SkillBridge Pro as a Developer! We're excited to help you build your career and connect with amazing projects.",
          nextSteps: [
            "Verify your email to activate your developer account",
            "Complete your developer profile with skills and experience",
            "Browse and apply to exciting projects that match your expertise",
            "Build your portfolio and showcase your work",
            "Connect with project owners and fellow developers",
          ],
          buttonColor: "135deg, #3b82f6 0%, #8b5cf6 100%",
          buttonText: "✅ Verify My Developer Account",
        },
        "project-owner": {
          gradient: "135deg, #10b981 0%, #14b8a6 100%",
          emoji: "🏢",
          title: "Welcome Project Owner!",
          greeting: `Hello ${name},`,
          message:
            "Thank you for joining SkillBridge Pro as a Project Owner! We're thrilled to help you find talented developers and bring your projects to life.",
          nextSteps: [
            "Verify your email to activate your project owner account",
            "Complete your company profile and business information",
            "Post your first project and start receiving applications",
            "Browse talented developers and their portfolios",
            "Build your dream development team",
          ],
          buttonColor: "135deg, #10b981 0%, #14b8a6 100%",
          buttonText: "✅ Verify My Project Owner Account",
        },
        admin: {
          gradient: "135deg, #ef4444 0%, #f97316 100%",
          emoji: "🔐",
          title: "Welcome Admin!",
          greeting: `Hello ${name},`,
          message:
            "Thank you for joining SkillBridge Pro as an Administrator! You now have access to manage and monitor the SkillBridge platform.",
          nextSteps: [
            "Verify your email to activate your admin account",
            "Access the admin dashboard and system controls",
            "Manage users, projects, and platform settings",
            "Monitor system analytics and performance",
            "Ensure platform security and quality",
          ],
          buttonColor: "135deg, #ef4444 0%, #f97316 100%",
          buttonText: "✅ Verify My Admin Account",
          securityNote: true,
        },
      };

      const template = templates[role] || templates.developer;

      return {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `✅ ${template.title} - Verify Your Email`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(${
              template.gradient
            }); padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${
                template.emoji
              } ${template.title}</h1>
            </div>
            <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #333; margin-top: 0;">${template.greeting}</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                ${
                  template.message
                } To get started, please verify your email address.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
                role === "developer"
                  ? "#3b82f6"
                  : role === "project-owner"
                  ? "#10b981"
                  : "#ef4444"
              };">
                <h3 style="color: ${
                  role === "developer"
                    ? "#3b82f6"
                    : role === "project-owner"
                    ? "#10b981"
                    : "#ef4444"
                }; margin-top: 0;">🚀 What's Next?</h3>
                <ul style="color: #666; line-height: 1.6;">
                  ${template.nextSteps
                    .map((step) => `<li>${step}</li>`)
                    .join("")}
                </ul>
              </div>
              ${
                template.securityNote
                  ? `
              <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                <p style="color: #991b1b; margin: 0; font-size: 14px;">
                  <strong>🔒 Security Notice:</strong> This is a secure admin account. Only authorized personnel should verify this email.
                </p>
              </div>
              `
                  : ""
              }
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(${
                     template.buttonColor
                   }); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
                  ${template.buttonText}
                </a>
              </div>
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>⏰ Important:</strong> This verification link will expire in 15 minutes for security reasons.
                </p>
              </div>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                If you didn't create an account with SkillBridge Pro, you can safely ignore this email.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 14px;">
              <p>This email was sent from SkillBridge Pro</p>
            </div>
          </div>
        `,
      };
    };

    const emailBody = getRoleSpecificSignupEmail(
      role,
      name,
      email,
      verificationUrl
    );

    await sendMail(emailBody);

    res.status(201).json({
      success: true,
      status: 201,
      message: "User registered successfully. Verification email sent.",
      user,
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Registration failed",
      error: error.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Verification token is required",
      });
    }

    // Hash the token before lookup (same as password reset flow)
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    let user = await UserModel.getUserByResetToken(hashedToken);

    // Backward compatibility: if not found with hashed token, try plain token
    // This handles tokens created before the hashing fix
    if (!user) {
      console.log(
        "Token not found with hash, trying plain token for backward compatibility"
      );
      user = await UserModel.getUserByResetToken(token);
    }

    if (!user) {
      console.error("Email verification: User not found with token", {
        tokenLength: token.length,
        hashedTokenLength: hashedToken.length,
      });
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Invalid verification token",
      });
    }

    if (user.resetPasswordExpire < new Date()) {
      console.error("Email verification: Token expired", {
        expireTime: user.resetPasswordExpire,
        currentTime: new Date(),
      });
      return res.status(400).json({
        success: false,
        status: 400,
        message:
          "Verification token has expired. Please request a new verification email.",
      });
    }

    await UserModel.updateUser(user.id, {
      isEmailVerified: true,
      resetPasswordToken: null,
      resetPasswordExpire: null,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Email verified successfully",
      user,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Email verification failed",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return new ErrorHandler("Please enter email and password", 400).sendError(
        res
      );
    }

    // ✅ Fetch user by email
    const user = await UserModel.getUserByEmail(email);
    console.log("user", user);

    // Check if email exists first
    if (!user) {
      return new ErrorHandler(
        "Account with this email does not exist. Please check your email address or sign up to create an account.",
        401
      ).sendError(res);
    }

    // ✅ Get user's roles to determine primary role if role not provided
    const userRoles = await UserModel.getUserRoles(user.id);
    const primaryRole =
      userRoles && userRoles.length > 0
        ? userRoles[0]
        : user.role || "developer";

    // ✅ Use provided role or fall back to primary role
    const requestedRole = role || primaryRole;

    // ✅ Check if user has the requested role (only if role was explicitly provided)
    if (role) {
      const hasRole = await UserModel.hasRole(user.id, role);
      if (!hasRole) {
        return new ErrorHandler(
          "You don't have the requested role. Please check your roles.",
          403
        ).sendError(res);
      }
    }

    // ✅ Check password - only check if user exists
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    console.log("isPasswordMatch", isPasswordMatch);
    if (!isPasswordMatch) {
      return new ErrorHandler(
        "Incorrect password. Please check your password and try again.",
        401
      ).sendError(res);
    }

    // 🚨 If email not verified → send verification email again (unless test email or in test/dev mode)
    // Auto-verify test emails or allow unverified login in test mode
    const isTestEmail =
      user.email.includes("test_") || user.email.endsWith("@example.com");
    const isTestMode =
      process.env.NODE_ENV === "test" ||
      process.env.ALLOW_UNVERIFIED_LOGIN === "true" ||
      process.env.ALLOW_UNVERIFIED_LOGIN === "1";

    // Auto-verify test emails if not already verified
    if (isTestEmail && !user.isEmailVerified) {
      await UserModel.updateUser(user.id, {
        isEmailVerified: true,
        resetPasswordToken: null,
        resetPasswordExpire: null,
      });
      user.isEmailVerified = true;
    }

    if (!user.isEmailVerified && !isTestMode) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      // Hash the token before storing (same as password reset flow)
      const hashedVerificationToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

      await UserModel.updateUser(user.id, {
        resetPasswordToken: hashedVerificationToken,
        resetPasswordExpire: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      });

      const verifyEmailBaseUrl =
        process.env.VERIFY_EMAIL_URL ||
        process.env.CLIENT_URL + "/verify-email";
      const verificationUrl = `${verifyEmailBaseUrl}?token=${verificationToken}`;

      // Role-specific login verification email template generator
      const getRoleSpecificLoginVerificationEmail = (
        role,
        userName,
        userEmail,
        verificationUrl
      ) => {
        const templates = {
          developer: {
            gradient: "135deg, #3b82f6 0%, #8b5cf6 100%",
            emoji: "👨‍💻",
            title: "Email Verification Required",
            greeting: `Hello ${userName},`,
            message:
              "We noticed you're trying to log in to your Developer account, but your email address hasn't been verified yet. Please verify your email to access your developer dashboard and start applying to projects.",
            actionText:
              "To complete your login and access your developer account, please verify your email address by clicking the button below.",
            buttonColor: "135deg, #3b82f6 0%, #8b5cf6 100%",
            buttonText: "✅ Verify My Developer Account",
            afterVerification:
              "Once verified, you'll be able to log in and access your developer dashboard, browse projects, and build your career!",
          },
          "project-owner": {
            gradient: "135deg, #10b981 0%, #14b8a6 100%",
            emoji: "🏢",
            title: "Email Verification Required",
            greeting: `Hello ${userName},`,
            message:
              "We noticed you're trying to log in to your Project Owner account, but your email address hasn't been verified yet. Please verify your email to access your project management dashboard.",
            actionText:
              "To complete your login and access your project owner account, please verify your email address by clicking the button below.",
            buttonColor: "135deg, #10b981 0%, #14b8a6 100%",
            buttonText: "✅ Verify My Project Owner Account",
            afterVerification:
              "Once verified, you'll be able to log in and access your project dashboard, post projects, and hire talented developers!",
          },
          admin: {
            gradient: "135deg, #ef4444 0%, #f97316 100%",
            emoji: "🔐",
            title: "Email Verification Required - Admin Account",
            greeting: `Hello ${userName},`,
            message:
              "We noticed you're trying to log in to your Admin account, but your email address hasn't been verified yet. Please verify your email to access the admin dashboard.",
            actionText:
              "To complete your login and access the admin panel, please verify your email address by clicking the button below.",
            buttonColor: "135deg, #ef4444 0%, #f97316 100%",
            buttonText: "✅ Verify My Admin Account",
            afterVerification:
              "Once verified, you'll be able to log in and access the admin dashboard to manage and monitor the SkillBridge platform.",
            securityNote: true,
          },
        };

        const template = templates[role] || templates.developer;

        return {
          from: process.env.EMAIL_USER,
          to: userEmail,
          subject: `${template.emoji} ${template.title} - SkillBridge Pro`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(${
                template.gradient
              }); padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">${
                  template.emoji
                } ${template.title}</h1>
              </div>
              <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin-top: 20px;">
                <h2 style="color: #333; margin-top: 0;">${
                  template.greeting
                }</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  ${template.message}
                </p>
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
                  role === "developer"
                    ? "#3b82f6"
                    : role === "project-owner"
                    ? "#10b981"
                    : "#ef4444"
                };">
                  <h3 style="color: ${
                    role === "developer"
                      ? "#3b82f6"
                      : role === "project-owner"
                      ? "#10b981"
                      : "#ef4444"
                  }; margin-top: 0;">⚠️ Action Required</h3>
                  <p style="color: #666; line-height: 1.6; margin: 0;">
                    ${template.actionText}
                  </p>
                </div>
                ${
                  template.securityNote
                    ? `
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                  <p style="color: #991b1b; margin: 0; font-size: 14px;">
                    <strong>🔒 Security Notice:</strong> This is a secure admin account. Only authorized personnel should verify this email.
                  </p>
                </div>
                `
                    : ""
                }
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" 
                     style="background: linear-gradient(${
                       template.buttonColor
                     }); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
                    ${template.buttonText}
                  </a>
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                  <p style="color: #856404; margin: 0; font-size: 14px;">
                    <strong>⏰ Important:</strong> This verification link will expire in 15 minutes for security reasons.
                  </p>
                </div>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  ${template.afterVerification}
                </p>
              </div>
              <div style="text-align: center; margin-top: 20px; color: #999; font-size: 14px;">
                <p>This email was sent from SkillBridge Pro</p>
              </div>
            </div>
          `,
        };
      };

      const emailBody = getRoleSpecificLoginVerificationEmail(
        requestedRole,
        user.name,
        user.email,
        verificationUrl
      );

      await sendMail(emailBody);

      return res.status(403).json({
        success: false,
        status: 403,
        message:
          "Email not verified. A new verification link has been sent to your email.",
      });
    }

    // ✅ Generate signed URLs for avatarUrl
    if (user.avatarUrl) {
      const { data, error } = await supabase.storage
        .from("upload")
        .createSignedUrl(user.avatarUrl, 60 * 60); // 1 hour
      if (!error) {
        user.avatarUrl = data.signedUrl;
      }
    }

    // ✅ Parse and generate signed URL for resumeUrl
    if (typeof user.resumeUrl === "string") {
      try {
        user.resumeUrl = JSON.parse(user.resumeUrl);
      } catch (e) {
        console.error("Failed to parse resumeUrl:", e);
        user.resumeUrl = null;
      }
    }

    if (user.resumeUrl?.path) {
      const { data, error } = await supabase.storage
        .from("upload")
        .createSignedUrl(user.resumeUrl.path, 60 * 60); // 1 hour
      if (!error) {
        user.resumeUrl = {
          url: data.signedUrl,
          originalName: user.resumeUrl.originalName,
        };
      }
    }

    // ✅ Get user roles for JWT (if not already fetched)
    const roles = userRoles || (await UserModel.getUserRoles(user.id));

    // ✅ Generate JWT including roles
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: requestedRole, // Use requested role or primary role
        roles: roles, // New: array of all user roles
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      status: 200,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Login failed",
      error: error.message,
    });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return new ErrorHandler("Email is required", 400).sendError(res);
    }

    const user = await UserModel.getUserByEmail(email);
    if (!user) {
      return new ErrorHandler("User not found with this email", 404).sendError(
        res
      );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const expireTime = new Date(Date.now() + 15 * 60 * 1000);

    await UserModel.setResetPasswordToken(user.id, hashedToken, expireTime);

    const resetPasswordBaseUrl =
      process.env.RESET_PASSWORD_URL ||
      process.env.CLIENT_URL + "/reset-password";
    const resetUrl = `${resetPasswordBaseUrl}?token=${resetToken}`;
    const emailBody = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔒 Password Reset Request - SkillBridge Pro",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔒 Password Reset Request</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 10px; margin-top: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hello,</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for your SkillBridge Pro account. If you made this request, please click the button below to reset your password.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="color: #dc3545; margin-top: 0;">🔐 Security Notice</h3>
              <p style="color: #666; line-height: 1.6; margin: 0;">
                For your security, this password reset link will expire in 15 minutes. If you didn't request this reset, please ignore this email and your password will remain unchanged.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
                🔒 Reset My Password
              </a>
            </div>
            <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8; margin: 20px 0;">
              <h4 style="color: #0c5460; margin-top: 0;">💡 Security Tips:</h4>
              <ul style="color: #0c5460; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>Use a strong, unique password</li>
                <li>Don't share your password with anyone</li>
                <li>Enable two-factor authentication if available</li>
                <li>Log out from shared devices</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              If you're having trouble with the button above, copy and paste the following link into your browser:
            </p>
            <div style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px; color: #495057;">
              ${resetUrl}
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 14px;">
            <p>This email was sent from SkillBridge Pro</p>
          </div>
        </div>
      `,
    };

    await sendMail(emailBody);

    res.status(200).json({
      success: true,
      status: 200,
      message: `Reset password link sent to ${email}`,
    });
  } catch (error) {
    console.error("Forget Password Error:", error);

    // Provide user-friendly error messages
    let errorMessage = "Failed to send reset password email";
    if (
      error.message.includes("authentication failed") ||
      error.message.includes("EAUTH")
    ) {
      errorMessage =
        "Email service configuration error. Please contact support.";
      console.error(
        "⚠️ Email service not properly configured. Check EMAIL_USER and EMAIL_PASS environment variables."
      );
    } else if (
      error.message.includes("connection") ||
      error.message.includes("timeout")
    ) {
      errorMessage =
        "Unable to connect to email service. Please try again later.";
    } else {
      errorMessage = error.message || "Failed to send email";
    }

    res.status(500).json({
      success: false,
      status: 500,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return new ErrorHandler(
        "Token and new password are required",
        400
      ).sendError(res);
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await UserModel.getUserByResetToken(hashedToken);

    if (!user || user.resetPasswordExpire < new Date()) {
      return new ErrorHandler("Invalid or expired token", 400).sendError(res);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.updateUser(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpire: null,
    });

    res.status(200).json({
      success: true,
      status: 200,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Reset failed",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return new ErrorHandler(
        "Both current and new password are required",
        400
      ).sendError(res);
    }

    const user = await UserModel.getUserById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return new ErrorHandler("Current password is incorrect", 401).sendError(
        res
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(userId, hashedPassword);

    res.status(200).json({
      success: true,
      status: 200,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Update failed",
      error: error.message,
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await UserModel.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found",
      });
    }

    // ✅ Avatar signed URL
    if (user.avatarUrl) {
      const { data, error } = await supabase.storage
        .from("upload")
        .createSignedUrl(user.avatarUrl, 60 * 60); // 1 hour
      if (!error) {
        user.avatarUrl = data.signedUrl;
      }
    }

    // ✅ ResumeUrl might be JSON or null
    if (typeof user.resumeUrl === "string") {
      try {
        user.resumeUrl = JSON.parse(user.resumeUrl);
      } catch (e) {
        console.error("Failed to parse resumeUrl:", e);
        user.resumeUrl = null;
      }
    }

    if (user.resumeUrl?.path) {
      const { data, error } = await supabase.storage
        .from("upload")
        .createSignedUrl(user.resumeUrl.path, 60 * 60); // 1 hour
      if (!error) {
        user.resumeUrl = {
          url: data.signedUrl,
          originalName: user.resumeUrl.originalName,
        };
      }
    }

    return res.status(200).json({ success: true, status: 200, user });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

const sanitizeNulls = (obj) => {
  for (const key in obj) {
    if (obj[key] === "null" || obj[key] === "undefined" || obj[key] === "") {
      obj[key] = null;
    }
  }
  return obj;
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    let updateData = { ...req.body };

    // Normalize "null"/"undefined"/"" → null
    updateData = sanitizeNulls(updateData);

    const isInvalidUrl = (value) =>
      typeof value === "string" &&
      (value.startsWith("http") || value.includes("?token="));

    if (updateData.avatarUrl && isInvalidUrl(updateData.avatarUrl)) {
      delete updateData.avatarUrl;
    }

    if (updateData.resumeUrl && isInvalidUrl(updateData.resumeUrl)) {
      delete updateData.resumeUrl;
    }

    if (req.files?.avatar) {
      const avatarUpload = await uploadFileToSupabase(
        req.files.avatar,
        "avatars"
      );
      updateData.avatarUrl = avatarUpload.path;
    }

    if (req.files?.resume) {
      const resumeUpload = await uploadFileToSupabase(
        req.files.resume,
        "resumes"
      );
      updateData.resumeUrl = JSON.stringify({
        path: resumeUpload.path,
        originalName: resumeUpload.originalName,
      });
    }

    if (updateData.resetPasswordExpire !== undefined) {
      if (!updateData.resetPasswordExpire) {
        updateData.resetPasswordExpire = null;
      } else {
        const date = new Date(updateData.resetPasswordExpire);
        updateData.resetPasswordExpire = isNaN(date) ? null : date;
      }
    }

    // Parse skills if coming as string
    if (updateData.skills && typeof updateData.skills === "string") {
      updateData.skills = JSON.parse(updateData.skills);
    }

    const updatedUser = await UserModel.updateProfile(userId, updateData);

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Profile updated",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    await UserModel.deleteUser(userId);
    res.status(200).json({
      success: true,
      status: 200,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

const updateOAuth = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { provider, accessToken, refreshToken } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "User not authenticated",
      });
    }

    if (!provider) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Provider is required",
      });
    }

    // Update OAuth provider in user record
    const updateData = {
      oauthProvider: provider,
    };

    // If accessToken is provided, try to extract oauthId from token or use provider
    // For now, we'll use a placeholder since we don't have the actual OAuth ID
    if (accessToken) {
      // In a real scenario, you'd decode the token or fetch user info from OAuth provider
      // For now, we'll just store the provider
      updateData.oauthId = `${provider}_${userId}`;
    }

    const updated = await UserModel.updateOAuthDetails(userId, updateData);

    // If there's a portfolio sync model and accessToken is provided, also update there
    if (accessToken) {
      try {
        const PortfolioSyncModel = require("../models/portfolio-sync.model");
        await PortfolioSyncModel.upsertIntegrationToken(
          userId,
          provider.toLowerCase(),
          {
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            isActive: true,
          }
        );
      } catch (syncError) {
        console.warn(
          "Failed to update portfolio sync tokens:",
          syncError.message
        );
        // Don't fail the request if portfolio sync update fails
      }
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: "OAuth details updated",
      user: updated,
    });
  } catch (error) {
    console.error("OAuth update error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to update OAuth",
      error: error.message,
    });
  }
};

// controllers/logout.controller.js
const logoutUser = async (req, res) => {
  try {
    // If you use cookies for JWT, clear the cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Otherwise, just respond with success for client to remove token
    res.status(200).json({
      success: true,
      status: 200,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Logout failed",
      error: error.message,
    });
  }
};

const getDevelopers = async (req, res) => {
  try {
    const {
      search,
      experience,
      location,
      skills,
      availability,
      limit = 20,
      page = 1,
    } = req.query;

    const filters = {
      search,
      experience,
      location,
      skills,
      availability,
      limit: parseInt(limit),
      page: parseInt(page),
    };

    const developers = await UserModel.getDevelopers(filters);

    // Generate signed URLs for avatars
    const developersWithSignedUrls = await Promise.all(
      developers.map(async (developer) => {
        if (developer.avatarUrl) {
          try {
            const { data, error } = await supabase.storage
              .from("upload")
              .createSignedUrl(developer.avatarUrl, 60 * 60); // 1 hour
            if (!error && data) {
              developer.avatarUrl = data.signedUrl;
            }
          } catch (error) {
            console.error("Error generating signed URL for avatar:", error);
          }
        }
        return developer;
      })
    );

    res.status(200).json({
      success: true,
      status: 200,
      developers: developersWithSignedUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: developersWithSignedUrls.length,
      },
    });
  } catch (error) {
    console.error("Get developers error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch developers",
      error: error.message,
    });
  }
};

// Get users for chat (developers and project-owners)
const getChatUsers = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { search, limit = 200 } = req.query;

    const filters = {
      search,
      limit: parseInt(limit),
      excludeUserId: userId ? parseInt(userId) : null,
    };

    // Fetch users with roles developer and project-owner
    const users = await UserModel.getUsersByRoles(
      ["developer", "project-owner"],
      filters
    );

    // Generate signed URLs for avatars
    const usersWithSignedUrls = await Promise.all(
      users.map(async (user) => {
        if (user.avatarUrl) {
          try {
            const { data, error } = await supabase.storage
              .from("upload")
              .createSignedUrl(user.avatarUrl, 60 * 60); // 1 hour
            if (!error && data) {
              user.avatarUrl = data.signedUrl;
            }
          } catch (error) {
            console.error("Error generating signed URL for avatar:", error);
          }
        }
        return user;
      })
    );

    res.status(200).json({
      success: true,
      status: 200,
      message: "Users retrieved successfully",
      data: usersWithSignedUrls,
      count: usersWithSignedUrls.length,
    });
  } catch (error) {
    console.error("Get chat users error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// ============================================
// DEVELOPER FAVORITES
// ============================================

const addDeveloperFavorite = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { developerId } = req.body;

    if (!userId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    // Check if developer exists
    const developer = await UserModel.getUserById(developerId);
    if (!developer || developer.isDeleted) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer not found",
      });
    }

    // Check if already favorited
    const existingFavorites = await UserModel.getDeveloperFavorites(userId);
    if (
      existingFavorites.some(
        (fav) =>
          fav.developerId === developerId || fav.developer_id === developerId
      )
    ) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: "Developer already in favorites",
      });
    }

    const favorite = await UserModel.addDeveloperFavorite(userId, developerId);
    return res.status(201).json({
      success: true,
      status: 201,
      message: "Developer added to favorites",
      favorite,
    });
  } catch (error) {
    console.error("Add Developer Favorite Error:", error);
    // Handle duplicate key error
    if (
      error.code === "23505" ||
      error.message.includes("duplicate") ||
      error.message.includes("unique")
    ) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: "Developer already in favorites",
        error: error.message,
      });
    }
    // Handle foreign key constraint error
    if (error.code === "23503" || error.message.includes("foreign key")) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer not found",
        error: error.message,
      });
    }
    // Handle table not found error
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      (error.message?.includes("relation") &&
        error.message?.includes("does not exist"))
    ) {
      return res.status(503).json({
        success: false,
        status: 503,
        message:
          "Service temporarily unavailable. Database table not initialized.",
        error: "Please contact support if this issue persists",
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to add favorite",
      error: error.message,
    });
  }
};

const removeDeveloperFavorite = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { developerId } = req.body;

    if (!userId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    await UserModel.removeDeveloperFavorite(userId, developerId);
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Developer removed from favorites",
    });
  } catch (error) {
    console.error("Remove Developer Favorite Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to remove favorite",
      error: error.message,
    });
  }
};

const getDeveloperFavorites = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const favorites = await UserModel.getDeveloperFavorites(userId);
    return res.status(200).json({
      success: true,
      status: 200,
      favorites,
    });
  } catch (error) {
    console.error("Get Developer Favorites Error:", error);
    // Handle table not found error - return empty array gracefully
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      (error.message?.includes("relation") &&
        error.message?.includes("does not exist"))
    ) {
      return res.status(200).json({
        success: true,
        status: 200,
        favorites: [],
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch favorites",
      error: error.message,
    });
  }
};

// ============================================
// DEVELOPER SAVES
// ============================================

const addDeveloperSave = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { developerId } = req.body;

    if (!userId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    // Check if developer exists
    const developer = await UserModel.getUserById(developerId);
    if (!developer || developer.isDeleted) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer not found",
      });
    }

    // Check if already saved
    const existingSaves = await UserModel.getDeveloperSaves(userId);
    if (
      existingSaves.some(
        (save) =>
          save.developerId === developerId || save.developer_id === developerId
      )
    ) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: "Developer already saved",
      });
    }

    const save = await UserModel.addDeveloperSave(userId, developerId);
    return res.status(201).json({
      success: true,
      status: 201,
      message: "Developer saved",
      save,
    });
  } catch (error) {
    console.error("Add Developer Save Error:", error);
    // Handle duplicate key error
    if (
      error.code === "23505" ||
      error.message.includes("duplicate") ||
      error.message.includes("unique")
    ) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: "Developer already saved",
        error: error.message,
      });
    }
    // Handle foreign key constraint error
    if (error.code === "23503" || error.message.includes("foreign key")) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer not found",
        error: error.message,
      });
    }
    // Handle table not found error
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      (error.message?.includes("relation") &&
        error.message?.includes("does not exist"))
    ) {
      return res.status(503).json({
        success: false,
        status: 503,
        message:
          "Service temporarily unavailable. Database table not initialized.",
        error: "Please contact support if this issue persists",
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to save developer",
      error: error.message,
    });
  }
};

const removeDeveloperSave = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { developerId } = req.body;

    if (!userId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    await UserModel.removeDeveloperSave(userId, developerId);
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Developer unsaved",
    });
  } catch (error) {
    console.error("Remove Developer Save Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to unsave developer",
      error: error.message,
    });
  }
};

const getDeveloperSaves = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const saves = await UserModel.getDeveloperSaves(userId);
    return res.status(200).json({
      success: true,
      status: 200,
      saves,
    });
  } catch (error) {
    console.error("Get Developer Saves Error:", error);
    // Handle table not found error - return empty array gracefully
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      (error.message?.includes("relation") &&
        error.message?.includes("does not exist"))
    ) {
      return res.status(200).json({
        success: true,
        status: 200,
        saves: [],
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch saves",
      error: error.message,
    });
  }
};

// ============================================
// DEVELOPER APPLICATIONS (Project Owner Outreach)
// ============================================

const applyToDeveloper = async (req, res) => {
  try {
    const applicantId = req.user?.userId;
    const { developerId, projectId, message, notes } = req.body;

    if (!applicantId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    // Check if developer exists
    const developer = await UserModel.getUserById(developerId);
    if (!developer || developer.isDeleted) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer not found",
      });
    }

    const application = await UserModel.applyToDeveloper({
      projectOwnerId: applicantId,
      developerId,
      projectId,
      message,
      notes,
    });

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Apply to Developer Error:", error);
    // Handle duplicate key error
    if (
      error.code === "23505" ||
      error.message.includes("duplicate") ||
      error.message.includes("unique")
    ) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: "Application already exists",
        error: error.message,
      });
    }
    // Handle foreign key constraint error
    if (error.code === "23503" || error.message.includes("foreign key")) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Developer or project not found",
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Application failed",
      error: error.message,
    });
  }
};

const withdrawDeveloperApplication = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { developerId } = req.body;

    if (!userId || !developerId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId and developerId are required",
      });
    }

    const result = await UserModel.withdrawDeveloperApplication(
      userId,
      developerId
    );
    return res.status(200).json({
      success: true,
      status: 200,
      message: result
        ? "Application withdrawn"
        : "No existing application found",
      application: result || null,
    });
  } catch (error) {
    console.error("Withdraw Developer Application Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Withdraw failed",
      error: error.message,
    });
  }
};

const getMyDeveloperApplications = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const applications = await UserModel.getMyDeveloperApplications(userId);
    return res.status(200).json({
      success: true,
      status: 200,
      applications,
    });
  } catch (error) {
    console.error("Get My Developer Applications Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch my applications",
      error: error.message,
    });
  }
};

const getMyDeveloperApplicationsCount = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const count = await UserModel.getMyDeveloperApplicationsCount(userId);
    return res.status(200).json({
      success: true,
      status: 200,
      count,
    });
  } catch (error) {
    console.error("Get My Developer Applications Count Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch applications count",
      error: error.message,
    });
  }
};

const getAppliedDevelopers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const appliedDevelopers = await UserModel.getAppliedDevelopers(userId);
    return res.status(200).json({
      success: true,
      status: 200,
      appliedDevelopers,
    });
  } catch (error) {
    console.error("Get Applied Developers Error:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch applied developers",
      error: error.message,
    });
  }
};

// Role Management Functions

// Assign role to user
const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const assignedBy = req.user.userId; // Admin who is assigning the role

    if (!role) {
      return new ErrorHandler("Role is required", 400).sendError(res);
    }

    const validRoles = ["developer", "project-owner", "admin"];
    if (!validRoles.includes(role)) {
      return new ErrorHandler(
        "Invalid role. Must be one of: developer, project-owner, admin",
        400
      ).sendError(res);
    }

    // Check if user exists
    const user = await UserModel.getUserById(userId);
    if (!user) {
      return new ErrorHandler("User not found", 404).sendError(res);
    }

    // Assign the role
    const userRole = await UserModel.assignRole(userId, role, assignedBy);

    res.status(201).json({
      success: true,
      status: 201,
      message: `Role '${role}' assigned successfully`,
      data: userRole,
    });
  } catch (error) {
    console.error("Assign role error:", error);
    if (error.message.includes("already has the role")) {
      return new ErrorHandler(error.message, 409).sendError(res);
    }
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to assign role",
      error: error.message,
    });
  }
};

// Remove role from user
const removeRole = async (req, res) => {
  try {
    const { userId, role } = req.params;

    // Check if user exists
    const user = await UserModel.getUserById(userId);
    if (!user) {
      return new ErrorHandler("User not found", 404).sendError(res);
    }

    // Check if user has this role
    const hasRole = await UserModel.hasRole(userId, role);
    if (!hasRole) {
      return new ErrorHandler(
        `User does not have the role '${role}'`,
        404
      ).sendError(res);
    }

    // Remove the role
    const removedRole = await UserModel.removeRole(userId, role);

    res.status(200).json({
      success: true,
      status: 200,
      message: `Role '${role}' removed successfully`,
      data: removedRole,
    });
  } catch (error) {
    console.error("Remove role error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to remove role",
      error: error.message,
    });
  }
};

// Get user roles
const getUserRoles = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await UserModel.getUserById(userId);
    if (!user) {
      return new ErrorHandler("User not found", 404).sendError(res);
    }

    // Get user roles
    const roles = await UserModel.getUserRoles(userId);

    res.status(200).json({
      success: true,
      status: 200,
      data: {
        userId: parseInt(userId),
        roles: roles,
      },
    });
  } catch (error) {
    console.error("Get user roles error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch user roles",
      error: error.message,
    });
  }
};

// Get user with roles
const getUserWithRoles = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserModel.getUserWithRoles(userId);
    if (!user) {
      return new ErrorHandler("User not found", 404).sendError(res);
    }

    res.status(200).json({
      success: true,
      status: 200,
      data: user,
    });
  } catch (error) {
    console.error("Get user with roles error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch user with roles",
      error: error.message,
    });
  }
};

// Get role statistics
const getRoleStats = async (req, res) => {
  try {
    const allUsers = await UserModel.getAllUsers();

    // Count roles
    const roleStats = {
      developer: 0,
      "project-owner": 0,
      admin: 0,
    };

    allUsers.forEach((user) => {
      const roles = user.roles || [];
      roles.forEach((role) => {
        if (roleStats.hasOwnProperty(role)) {
          roleStats[role]++;
        }
      });
    });

    res.status(200).json({
      success: true,
      status: 200,
      data: roleStats,
    });
  } catch (error) {
    console.error("Get role stats error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch role statistics",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN ANALYTICS
// ============================================

// Get admin analytics
const getAdminAnalytics = async (req, res) => {
  try {
    const { timeframe = "6m" } = req.query;
    const axios = require("axios");

    const analytics = await UserModel.getAdminAnalytics(timeframe);

    // Get project stats from project-service
    let projectStats = {
      projectsPosted: 0,
      projectsByDomain: [],
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      monthlyGrowth: 0,
    };

    try {
      const API_GATEWAY_URL =
        process.env.API_GATEWAY_URL ||
        process.env.API_GATEWAY_BASE_URL ||
        process.env.BACKEND_URL;
      const authToken = req.headers.authorization; // Forward auth token

      const projectStatsResponse = await axios.get(
        `${API_GATEWAY_URL}/api/v1/projects/admin/stats?timeframe=${timeframe}`,
        {
          headers: {
            Authorization: authToken,
          },
          timeout: 10000,
          validateStatus: (status) => status < 500,
        }
      );

      if (
        projectStatsResponse.status === 200 &&
        projectStatsResponse.data?.success
      ) {
        const stats = projectStatsResponse.data.data;
        projectStats = {
          projectsPosted: stats.totalProjects || 0,
          projectsInTimeframe: stats.projectsInTimeframe || 0,
          totalProjects: stats.totalProjects || 0,
          activeProjects: stats.activeProjects || 0,
          completedProjects: stats.completedProjects || 0,
          projectsByDomain: stats.projectsByCategory || [],
          projectsByMonth: stats.projectsByMonth || [],
          monthlyGrowth: stats.monthlyGrowth || 0,
        };
      } else {
        console.warn(
          "Failed to fetch project stats from project-service:",
          projectStatsResponse.status,
          projectStatsResponse.data
        );
      }
    } catch (error) {
      console.error(
        "Error fetching project stats from project-service:",
        error.message
      );
      // Continue with default project stats if service is unavailable
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: "Admin analytics retrieved successfully",
      data: {
        ...analytics,
        projectStats,
      },
    });
  } catch (error) {
    console.error("Get admin analytics error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch admin analytics",
      error: error.message,
    });
  }
};

// ============================================
// DEVELOPER DASHBOARD / GAMIFICATION
// ============================================

// Get developer stats
const getDeveloperStats = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const stats = await UserModel.getDeveloperStats(userId);
    if (!stats) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: "Developer stats retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Get developer stats error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch developer stats",
      error: error.message,
    });
  }
};

// Get developer reviews
const getDeveloperReviews = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const reviews = await UserModel.getDeveloperReviews(userId, limit);

    res.status(200).json({
      success: true,
      status: 200,
      message: "Developer reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Get developer reviews error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch developer reviews",
      error: error.message,
    });
  }
};

// Get developer endorsements
const getDeveloperEndorsements = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const endorsements = await UserModel.getDeveloperEndorsements(
      userId,
      limit
    );

    res.status(200).json({
      success: true,
      status: 200,
      message: "Developer endorsements retrieved successfully",
      data: endorsements,
    });
  } catch (error) {
    console.error("Get developer endorsements error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch developer endorsements",
      error: error.message,
    });
  }
};

// Get leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await UserModel.getLeaderboard(limit);

    res.status(200).json({
      success: true,
      status: 200,
      message: "Leaderboard retrieved successfully",
      data: leaderboard,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch leaderboard",
      error: error.message,
    });
  }
};

// Get developer achievements
const getDeveloperAchievements = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Authentication required",
      });
    }

    const achievements = await UserModel.getDeveloperAchievements(userId);

    res.status(200).json({
      success: true,
      status: 200,
      message: "Developer achievements retrieved successfully",
      data: achievements,
    });
  } catch (error) {
    console.error("Get developer achievements error:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to fetch developer achievements",
      error: error.message,
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUser,
  verifyEmail,
  updateOAuth,
  changePassword,
  forgetPassword,
  resetPassword,
  logoutUser,
  getDevelopers,
  getChatUsers,
  // Developer favorites
  addDeveloperFavorite,
  removeDeveloperFavorite,
  getDeveloperFavorites,
  // Developer saves
  addDeveloperSave,
  removeDeveloperSave,
  getDeveloperSaves,
  // Developer applications (outreach)
  applyToDeveloper,
  withdrawDeveloperApplication,
  getMyDeveloperApplications,
  getMyDeveloperApplicationsCount,
  getAppliedDevelopers,
  // Role management functions
  assignRole,
  removeRole,
  getUserRoles,
  getUserWithRoles,
  getRoleStats,
  // Admin Analytics
  getAdminAnalytics,
  // Developer Dashboard / Gamification
  getDeveloperStats,
  getDeveloperReviews,
  getDeveloperEndorsements,
  getLeaderboard,
  getDeveloperAchievements,
};
