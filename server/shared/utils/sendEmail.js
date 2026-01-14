const nodemailer = require("nodemailer");

async function sendMail(emailBody) {
  try {
    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = "Email configuration missing: EMAIL_USER or EMAIL_PASS not set";
      console.error("❌", errorMsg);
      throw new Error(errorMsg);
    }

    // Verify SMTP connection before sending
    const transporter = nodemailer.createTransport({
      secure: true,
      host: "smtp.gmail.com",
      port: 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Add connection timeout
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log("✅ SMTP server connection verified");
    } catch (verifyError) {
      console.error("❌ SMTP verification failed:", verifyError.message);
      if (verifyError.code === "EAUTH") {
        throw new Error("SMTP Authentication failed. Please check EMAIL_USER and EMAIL_PASS. Make sure you're using a Gmail App Password, not your regular password.");
      }
      throw verifyError;
    }

    const mailOptions = {
      from: emailBody.from || process.env.EMAIL_USER,
      to: emailBody.to,
      subject: emailBody.subject,
      text: emailBody.text || "",       // optional fallback plain text
      html: emailBody.html || "",       // required: actual email content
      headers: emailBody.headers || {},
    };

    console.log("📧 Sending email:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully");
    console.log("📬 Message ID:", info.messageId);
    console.log("📧 Response:", info.response);

    return info;
  } catch (error) {
    console.error("❌ Error sending email:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    // Provide helpful error messages
    if (error.code === "EAUTH") {
      throw new Error("Email authentication failed. Please verify EMAIL_USER and EMAIL_PASS are correct. For Gmail, you need to use an App Password, not your regular password.");
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      throw new Error("Could not connect to email server. Please check your internet connection and SMTP settings.");
    } else if (error.responseCode === 550) {
      throw new Error("Email rejected by server. Please check the recipient email address.");
    }

    throw error;
  }
}

module.exports = { sendMail };
