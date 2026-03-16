const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// Initialize SES Client
const ses = new SESClient({ region: process.env.REGION || 'us-east-1' });

exports.handler = async (event) => {
  console.log('Post Confirmation Event:', JSON.stringify(event, null, 2));

  // We only want to send the email when a new user confirms their sign up
  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    const userEmail = event.request.userAttributes.email;
  const senderEmail = process.env.SENDER_EMAIL || 'welcome@parallax.ai'; // Update this to your verified AWS SES identity in production

    if (!userEmail) {
      console.log('No email found in user attributes');
      return event;
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; }
          .logo { font-size: 28px; font-weight: 800; color: #38bdf8; margin-bottom: 24px; text-align: center; }
          h1 { color: #f8fafc; font-size: 24px; margin-bottom: 16px; text-align: center; }
          p { color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
          .highlight { color: #38bdf8; font-weight: 600; }
          .footer { margin-top: 40px; text-align: center; font-size: 14px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Parallax AI</div>
          <h1>Welcome to the Future of Content! 🚀</h1>
          <p>Hi there,</p>
          <p>Your email has been successfully verified, and your account is now active on <strong>Parallax AI</strong>.</p>
          <p>You can now start finding perfect <span class="highlight">collaborators</span>, drop brilliant ideas in <span class="highlight">The Spark</span>, discover trends in the <span class="highlight">Smart Vault</span>, and instantly generate viral shorts in the <span class="highlight">Parallax Lab</span>.</p>
          <p>We are thrilled to have you onboard.</p>
          <p>Stay creative,</p>
          <p><strong>The Parallax Team</strong></p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Parallax AI. Built for the Amazon Nova AI Hackathon.
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      Welcome to Parallax AI! 🚀
      
      Your email has been successfully verified, and your account is now active.
      You can now start finding perfect collaborators, drop brilliant ideas in The Spark, 
      discover trends in the Smart Vault, and instantly generate viral shorts in the Parallax Lab.
      
      Stay creative,
      The Parallax Team
    `;

    const params = {
      Source: senderEmail,
      Destination: {
        ToAddresses: [userEmail],
      },
      Message: {
        Subject: {
          Data: 'Welcome to Parallax AI! 🚀',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    };

    try {
      console.log(`Attempting to send welcome email to ${userEmail} from ${senderEmail}`);
      const command = new SendEmailCommand(params);
      await ses.send(command);
      console.log('Welcome email sent successfully!');
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // We don't throw the error so that the Cognito flow doesn't break even if SES fails (e.g., Sandbox limits)
    }
  }

  // Always return the event to Cognito so it can proceed
  return event;
};

