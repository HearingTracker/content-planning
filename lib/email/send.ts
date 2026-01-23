import type { EmailMessage, EmailResult } from "./types";

const NEWS_API_URL = "https://news.hearingtracker.com/api";
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Template ID for notification emails (shared with main site)
const NOTIFICATION_TEMPLATE_ID = "f8084938-7e33-4398-ac14-ca2992ed2c8a";

/**
 * Send an email using the HearingTracker news API (which uses AWS SES).
 *
 * Environment variables required:
 * - NEWS_API_KEY: API key for news.hearingtracker.com
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  // Log in development instead of sending
  if (process.env.NODE_ENV === "development") {
    console.log("[Email] Would send email:", {
      to: message.to,
      subject: message.subject,
      textPreview: message.text?.substring(0, 100),
    });
    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }

  if (!NEWS_API_KEY) {
    console.warn("[Email] NEWS_API_KEY not configured");
    return {
      success: false,
      error: "Email provider not configured",
    };
  }

  try {
    const response = await fetch(`${NEWS_API_URL}/emails/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEWS_API_KEY}`,
      },
      body: JSON.stringify({
        template_id: NOTIFICATION_TEMPLATE_ID,
        to: message.to,
        subject: message.subject,
        from_name: "HearingTracker Content",
        from_email: message.from || "notifications@hearingtracker.com",
        reply_to_email: message.replyTo,
        variables: {
          html: message.html || message.text || "",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Email] Send error:", response.status, errorData);
      return {
        success: false,
        error: `Failed to send email: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.id || `sent-${Date.now()}`,
    };
  } catch (err) {
    console.error("[Email] Error sending email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send a notification email to a user.
 */
export async function sendNotificationEmail(
  to: string,
  title: string,
  body: string,
  actionUrl?: string
): Promise<EmailResult> {
  const text = actionUrl
    ? `${title}\n\n${body}\n\nView: ${actionUrl}`
    : `${title}\n\n${body}`;

  const html = actionUrl
    ? `
      <h2>${title}</h2>
      <p>${body}</p>
      <p><a href="${actionUrl}">View in app</a></p>
    `
    : `
      <h2>${title}</h2>
      <p>${body}</p>
    `;

  return sendEmail({
    to,
    subject: title,
    text,
    html,
  });
}
