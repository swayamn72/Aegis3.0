/**
 * HTML Email Template for Email Verification
 * @param {string} username - User's username
 * @param {string} code - 6-digit verification code
 * @returns {string} - HTML email content
 */
export const verificationEmailTemplate = (username, code) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                🎮 Aegis Esports
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px; color: #e0e0e0;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
                Hi ${username}! 👋
              </h2>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Welcome to <strong style="color: #FF4500;">Aegis Esports</strong>! We're excited to have you join our community of competitive esports players.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                To complete your registration and start your journey, please verify your email address using the code below:
              </p>

              <!-- Verification Code Box -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <div style="background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%); border: 2px solid #FF4500; border-radius: 12px; padding: 30px; display: inline-block;">
                      <p style="margin: 0 0 10px; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 2px;">
                        Verification Code
                      </p>
                      <p style="margin: 0; font-size: 48px; font-weight: bold; color: #FF4500; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${code}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Warning -->
              <table role="presentation" style="width: 100%; margin: 20px 0; background-color: #2a2a2a; border-left: 4px solid #FFA500; border-radius: 8px;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #FFA500;">
                      ⏰ <strong>Important:</strong> This code expires in <strong>5 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px; font-size: 14px; line-height: 1.6; color: #888;">
                Enter this code on the verification page to activate your account. If you didn't create an account with Aegis, you can safely ignore this email.
              </p>

              <!-- Security Note -->
              <table role="presentation" style="width: 100%; margin: 30px 0; background-color: #1f1f1f; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #FF4500; font-weight: bold;">
                      🔒 Security Tip
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">
                      Never share your verification code with anyone. Aegis team will never ask for your code via email, phone, or social media.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f0f0f; padding: 30px; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #666;">
                Need help? Contact us at <a href="mailto:support@aegis.com" style="color: #FF4500; text-decoration: none;">support@aegis.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #555;">
                © ${new Date().getFullYear()} Aegis Esports. All rights reserved.
              </p>
              <div style="margin-top: 20px;">
                <a href="#" style="display: inline-block; margin: 0 10px; color: #666; text-decoration: none; font-size: 12px;">Privacy Policy</a>
                <span style="color: #333;">|</span>
                <a href="#" style="display: inline-block; margin: 0 10px; color: #666; text-decoration: none; font-size: 12px;">Terms of Service</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Plain Text Email Template for Email Verification
 * @param {string} username - User's username
 * @param {string} code - 6-digit verification code
 * @returns {string} - Plain text email content
 */
export const verificationEmailPlainText = (username, code) => {
  return `
Hi ${username}!

Welcome to Aegis Esports! We're excited to have you join our community.

To complete your registration, please verify your email address using the code below:

VERIFICATION CODE: ${code}

⏰ IMPORTANT: This code expires in 5 minutes.

Enter this code on the verification page to activate your account.

If you didn't create an account with Aegis, you can safely ignore this email.

🔒 Security Tip: Never share your verification code with anyone. Aegis team will never ask for your code.

Need help? Contact us at support@aegis.com

© ${new Date().getFullYear()} Aegis Esports. All rights reserved.
  `;
};

/**
 * Welcome Email Template (sent after successful verification)
 */
export const welcomeEmailTemplate = (username) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Aegis!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px;">🎉 Welcome to Aegis!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; color: #e0e0e0;">
              <h2 style="margin: 0 0 20px; color: #ffffff;">Hi ${username}!</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Your email has been verified successfully! 🎮
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                You're now part of the Aegis Esports community. Here's what you can do next:
              </p>
              <ul style="color: #b0b0b0; line-height: 1.8;">
                <li>Complete your profile setup</li>
                <li>Join or create a team</li>
                <li>Register for tournaments</li>
                <li>Connect with other players</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 15px 40px; background-color: #FF4500; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Get Started
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f0f0f; padding: 30px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #555;">
                © ${new Date().getFullYear()} Aegis Esports
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * HTML Email Template for Password Reset
 * @param {string} username - User's username
 * @param {string} resetLink - Password reset link
 * @returns {string} - HTML email content
 */
export const passwordResetEmailTemplate = (username, resetLink) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                🔐 Aegis Esports
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px; color: #e0e0e0;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
                Password Reset Request
              </h2>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Hi <strong style="color: #FF4500;">${username}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                We received a request to reset your password for your Aegis Esports account. If you didn't make this request, you can safely ignore this email.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                To reset your password, click the button below:
              </p>

              <!-- Reset Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 18px 50px; background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 69, 0, 0.4); transition: all 0.3s;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #888;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; font-size: 13px; word-break: break-all; padding: 15px; background-color: #2a2a2a; border-radius: 6px; border-left: 3px solid #FF4500;">
                <a href="${resetLink}" style="color: #FF4500; text-decoration: none;">${resetLink}</a>
              </p>

              <!-- Expiry Warning -->
              <table role="presentation" style="width: 100%; margin: 20px 0; background-color: #2a2a2a; border-left: 4px solid #FFA500; border-radius: 8px;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #FFA500;">
                      ⏰ <strong>Important:</strong> This link will expire in <strong>1 hour</strong> for your security.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Note -->
              <table role="presentation" style="width: 100%; margin: 30px 0; background-color: #1f1f1f; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #FF4500; font-weight: bold;">
                      🔒 Security Reminder
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.6;">
                      • Never share your password reset link with anyone<br>
                      • Aegis team will never ask for your password via email<br>
                      • If you didn't request this reset, please secure your account immediately
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f0f0f; padding: 30px; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #666;">
                Need help? Contact us at <a href="mailto:support@aegis.com" style="color: #FF4500; text-decoration: none;">support@aegis.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #555;">
                © ${new Date().getFullYear()} Aegis Esports. All rights reserved.
              </p>
              <div style="margin-top: 20px;">
                <a href="#" style="display: inline-block; margin: 0 10px; color: #666; text-decoration: none; font-size: 12px;">Privacy Policy</a>
                <span style="color: #333;">|</span>
                <a href="#" style="display: inline-block; margin: 0 10px; color: #666; text-decoration: none; font-size: 12px;">Terms of Service</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Plain Text Email Template for Password Reset
 * @param {string} username - User's username
 * @param {string} resetLink - Password reset link
 * @returns {string} - Plain text email content
 */
export const passwordResetEmailPlainText = (username, resetLink) => {
  return `
Password Reset Request

Hi ${username},

We received a request to reset your password for your Aegis Esports account. If you didn't make this request, you can safely ignore this email.

To reset your password, click the link below:

${resetLink}

⏰ IMPORTANT: This link will expire in 1 hour for your security.

🔒 Security Reminder:
• Never share your password reset link with anyone
• Aegis team will never ask for your password via email
• If you didn't request this reset, please secure your account immediately

If the link doesn't work, copy and paste it into your browser.

Need help? Contact us at support@aegis.com

© ${new Date().getFullYear()} Aegis Esports. All rights reserved.
  `;
};

/**
 * HTML Email Template for Tournament Registration
 */
export const tournamentRegistrationEmailTemplate = (username, teamName, tournamentName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournament Registration Successful</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🎯 Registration Accepted!</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px; color: #e0e0e0;">
              <h2 style="margin: 0 0 20px; color: #ffffff;">Hi ${username},</h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Your team <strong style="color: #FF4500;">${teamName}</strong> has been successfully registered for the tournament:
              </p>
              <div style="background-color: #2a2a2a; border-left: 4px solid #FF4500; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">
                   🏆 ${tournamentName}
                </p>
              </div>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Get ready and gather your team! Good luck in the competition!
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f0f0f; padding: 30px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #555;">© ${new Date().getFullYear()} Aegis Esports</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

export const tournamentRegistrationEmailPlainText = (username, teamName, tournamentName) => {
  return `
Registration Accepted!

Hi ${username},

Your team ${teamName} has been successfully registered for the tournament:
🏆 ${tournamentName}

Get ready and gather your team! Good luck!

© ${new Date().getFullYear()} Aegis Esports
  `;
};

