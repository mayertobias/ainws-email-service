const express = require('express');
const cors = require('cors');
const { EmailClient } = require('@azure/communication-email');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Log environment variables (without exposing sensitive data)
console.log('Environment Variables Check:');
console.log('AZURE_EMAIL_CONNECTION_STRING:', !!process.env.AZURE_EMAIL_CONNECTION_STRING ? 'Present' : 'Missing');
console.log('SENDER_EMAIL:', process.env.SENDER_EMAIL ? 'Present' : 'Missing');
console.log('RECIPIENT_EMAIL:', process.env.RECIPIENT_EMAIL ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT || 3001);

// Azure Communication Services configuration
const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
const senderEmail = process.env.SENDER_EMAIL;
const subscriptionSenderEmail = process.env.SUBSCRIPTION_SENDER_EMAIL;
const recipientEmail = process.env.RECIPIENT_EMAIL;

// Validate required environment variables
if (!connectionString) {
    console.error('Error: AZURE_EMAIL_CONNECTION_STRING is not set');
    process.exit(1);
}

if (!senderEmail) {
    console.error('Error: SENDER_EMAIL is not set');
    process.exit(1);
}

if (!recipientEmail) {
    console.error('Error: RECIPIENT_EMAIL is not set');
    process.exit(1);
}

// Initialize Email Client
let emailClient;

try {
    emailClient = new EmailClient(connectionString);
    console.log('EmailClient initialized successfully');
} catch (error) {
    console.error('Failed to initialize EmailClient:', error);
    process.exit(1);
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Sanitize HTML content to prevent XSS
function sanitizeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Newsletter subscription endpoint
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Received subscription request:', {
            email: email?.substring(0, 5) + '...', // Mask email for privacy
            timestamp: new Date().toISOString()
        });

        if (!email || !validateEmail(email)) {
            console.log('Invalid email:', email);
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address'
            });
        }

        // Create subscription confirmation message
        const emailMessage = {
            senderAddress: subscriptionSenderEmail,
            content: {
                subject: 'Thank you for subscribing to our newsletter',
                plainText: `Thank you for subscribing to our newsletter!\n\nYou will receive updates and insights from us soon.`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width">
                        <title>Welcome to Ainsemble Newsletter</title>
                        <style>
                            @media screen and (max-width: 600px) {
                                .container {
                                    padding: 10px !important;
                                }
                                .logo {
                                    width: 150px !important;
                                }
                            }
                        </style>
                    </head>
                    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div class="container" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <div style="background: #2c3e50; padding: 20px; text-align: center;">
                            <img class="logo" src="../assets/logomark.svg" alt="Logo" 
                                     style="max-width: 200px; height: auto;">
                                <img class="logo" src="../assets/whitewordmark.svg" alt="Ainsemble" 
                                     style="max-width: 200px; height: auto;">
                            </div>

                            <!-- Main Content -->
                            <div style="padding: 30px;">
                                <h1 style="color: #2c3e50; margin-top: 0; font-size: 24px;">
                                    Welcome to Ainsemble Newsletter
                                </h1>
                                <p style="color: #495057; margin-bottom: 20px;">
                                    Thank you for subscribing to our newsletter! We're excited to have you on board.
                                </p>

                                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h2 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 20px;">
                                        What to Expect
                                    </h2>
                                    <ul style="margin: 0; padding: 0; list-style: none;">
                                        <li style="margin-bottom: 10px;">
                                            <span style="color: #495057;">
                                                <strong>Industry Insights:</strong> Stay updated with the latest trends and innovations
                                            </span>
                                        </li>
                                        <li style="margin-bottom: 10px;">
                                            <span style="color: #495057;">
                                                <strong>Expert Analysis:</strong> Get in-depth analysis from our industry experts
                                            </span>
                                        </li>
                                        <li style="margin-bottom: 10px;">
                                            <span style="color: #495057;">
                                                <strong>Exclusive Content:</strong> Access to premium content and resources
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="https://ainsemble.com" 
                                       style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; 
                                              text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        Visit Website
                                    </a>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                                <p style="color: #666; margin: 0 0 10px 0;">
                                    You are receiving this email because you subscribed to our newsletter
                                </p>
                                <p style="color: #666; margin: 0;">
                                    © Ainsemble ${new Date().getFullYear()}. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            },
            recipients: {
                to: [
                    {
                        address: email
                    }
                ]
            }
        };

        console.log('Sending subscription confirmation to:', email);
        // Send subscription confirmation
        const poller = await emailClient.beginSend(emailMessage);
        const result = await poller.pollUntilDone();
        console.log('Subscription confirmation sent successfully:', {
            messageId: result.id,
            status: result.status
        });

        // Notify admin about new subscription
        const adminMessage = {
            senderAddress: subscriptionSenderEmail,
            content: {
                subject: 'New Newsletter Subscription',
                plainText: `New subscriber: ${email}\n\nDate: ${new Date().toISOString()}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>New Subscription</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                                New Newsletter Subscription
                            </h2>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p style="color: #495057;">A new user has subscribed to the newsletter:</p>
                                <p style="color: #495057; margin-top: 10px;">${email}</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            },
            recipients: {
                to: [
                    {
                        address: recipientEmail
                    }
                ]
            }
        };

        console.log('Sending admin notification to:', recipientEmail);
        // Send notification to admin
        const adminPoller = await emailClient.beginSend(adminMessage);
        const adminResult = await adminPoller.pollUntilDone();
        console.log('Admin notification sent successfully:', {
            messageId: adminResult.id,
            status: adminResult.status
        });

        res.status(200).json({
            success: true,
            message: 'Subscription successful! You will receive a confirmation email shortly.'
        });
    } catch (error) {
        console.error('Error in /api/subscribe:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process subscription. Please try again later.'
        });
    }
});

// Contact form endpoint
app.post('/api/send-email', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        console.log('Received email request:', { name, email: email?.substring(0, 5) + '...', subject });

        // Validate input
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'All fields (name, email, subject, message) are required'
            });
        }

        // Validate field lengths
        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Name must be less than 100 characters'
            });
        }

        if (subject.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Subject must be less than 200 characters'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Prevent spam
        if (message.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Message must be less than 2000 characters'
            });
        }

        // Sanitize inputs for HTML content
        const sanitizedName = sanitizeHtml(name);
        const sanitizedEmail = sanitizeHtml(email);
        const sanitizedSubject = sanitizeHtml(subject);
        const sanitizedMessage = sanitizeHtml(message);

        // Create email message with proper structure
        const emailMessage = {
            senderAddress: senderEmail,
            content: {
                subject: `Contact Form: ${sanitizedSubject}`,
                plainText: `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>Contact Form Submission</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                                New Contact Form Submission
                            </h2>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Name:</strong> ${sanitizedName}</p>
                                <p><strong>Email:</strong> ${sanitizedEmail}</p>
                                <p><strong>Subject:</strong> ${sanitizedSubject}</p>
                            </div>
                            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
                                <h3 style="color: #495057; margin-top: 0;">Message:</h3>
                                <p style="white-space: pre-line;">${sanitizedMessage}</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            },
            recipients: {
                to: [
                    {
                        address: recipientEmail
                    }
                ]
            }
        };

        console.log('Attempting to send email...');

        // Send email using beginSend method
        const poller = await emailClient.beginSend(emailMessage);
        console.log('Email send initiated, waiting for completion...');
        
        // Wait for the email to be sent
        const result = await poller.pollUntilDone();
        
        console.log('Email sent successfully:', {
            id: result.id,
            status: result.status
        });

        res.status(200).json({
            success: true,
            messageId: result.id,
            status: result.status
        });

    } catch (error) {
        console.error('Error in /api/send-email:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code,
            statusCode: error.statusCode
        });
        
        // Handle specific Azure Communication Services errors
        let errorMessage = 'Failed to send email. Please try again later.';
        
        if (error.code === 'Unauthorized') {
            errorMessage = 'Email service configuration error. Please contact support.';
        } else if (error.code === 'InvalidRequest' || error.statusCode === 400) {
            errorMessage = 'Invalid email request. Please check your input.';
        } else if (error.message && error.message.includes('domain')) {
            errorMessage = 'Email domain configuration error. Please contact support.';
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Email service is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Email server is running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
});