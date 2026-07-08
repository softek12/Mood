const crypto = require("crypto");

const PLACEHOLDER_VALUES = new Set([
  "YOUR_MAILCHIMP_API_KEY",
  "YOUR_MAILCHIMP_AUDIENCE_ID",
  "usX",
]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY || "YOUR_MAILCHIMP_API_KEY";
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX || "usX";
  const audienceId =
    process.env.MAILCHIMP_AUDIENCE_ID || "YOUR_MAILCHIMP_AUDIENCE_ID";

  if (
    !apiKey ||
    !serverPrefix ||
    !audienceId ||
    PLACEHOLDER_VALUES.has(apiKey) ||
    PLACEHOLDER_VALUES.has(serverPrefix) ||
    PLACEHOLDER_VALUES.has(audienceId)
  ) {
    return json(500, {
      message:
        "Mailchimp is not configured yet. Add MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and MAILCHIMP_AUDIENCE_ID in Netlify.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { message: "Invalid JSON payload." });
  }

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter(Boolean).map((tag) => String(tag).trim())
    : [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { message: "A valid email address is required." });
  }

  const subscriberHash = crypto
    .createHash("md5")
    .update(email)
    .digest("hex");

  try {
    const response = await fetch(
      `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`,
      {
        method: "PUT",
        headers: {
          Authorization: `apikey ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: "pending",
          status: "pending",
          tags,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        message:
          data.detail ||
          data.title ||
          "Mailchimp rejected the subscription request.",
      });
    }

    return json(200, {
      ok: true,
      message:
        "Thanks for subscribing. Please check your inbox to confirm your Mailchimp signup.",
      id: data.id,
      status: data.status,
    });
  } catch (error) {
    return json(500, {
      message:
        "Unable to reach Mailchimp right now. Verify your Netlify environment variables and try again.",
    });
  }
};
