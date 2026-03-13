import express, { Router } from "express";
import Stripe from "stripe";
import { query } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
const stripePriceId = String(process.env.STRIPE_PRICE_ID || "").trim();
const stripeTrialDaysRaw = Number(process.env.STRIPE_TRIAL_DAYS || 30);
const stripeTrialDays = Number.isFinite(stripeTrialDaysRaw)
  ? Math.max(0, Math.min(365, Math.floor(stripeTrialDaysRaw)))
  : 30;
const configuredAppBaseUrl = String(
  process.env.APP_BASE_URL || process.env.FRONTEND_BASE_URL || ""
)
  .trim()
  .replace(/\/$/, "");
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function normalizePlan(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "pro" ? "pro" : "free";
}

function normalizeSubscriptionStatus(value) {
  return String(value || "").trim().toLowerCase() || null;
}

function resolvePlanFromSubscriptionStatus(value) {
  const status = normalizeSubscriptionStatus(value);
  if (status === "active" || status === "trialing" || status === "past_due") {
    return "pro";
  }
  return "free";
}

function toIsoFromUnixTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp * 1000).toISOString();
}

function getAppBaseUrl(req) {
  if (configuredAppBaseUrl) return configuredAppBaseUrl;

  const origin = String(req.headers.origin || "").trim();
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/$/, "");

  const host = String(req.headers.host || "").trim();
  if (host) {
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
      .split(",")[0]
      .trim();
    return `${proto}://${host}`;
  }

  return "http://localhost:5173";
}

function ensureStripeCheckoutConfigured(res) {
  if (!stripe || !stripePriceId) {
    res.status(503).json({ error: "billing-not-configured" });
    return false;
  }
  return true;
}

function ensureStripePortalConfigured(res) {
  if (!stripe) {
    res.status(503).json({ error: "billing-not-configured" });
    return false;
  }
  return true;
}

async function findUserBillingInfoById(userId) {
  const result = await query(
    `
      SELECT
        id,
        email,
        username,
        plan,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        subscription_current_period_end
      FROM users
      WHERE id = $1
    `,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateSubscriptionByCustomerId({
  customerId,
  subscriptionId,
  subscriptionStatus,
  subscriptionCurrentPeriodEnd,
}) {
  const plan = resolvePlanFromSubscriptionStatus(subscriptionStatus);
  await query(
    `
      UPDATE users
      SET
        stripe_subscription_id = $1,
        subscription_status = $2,
        subscription_current_period_end = $3,
        plan = $4
      WHERE stripe_customer_id = $5
    `,
    [subscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd, plan, customerId]
  );
}

async function updateSubscriptionByUserId({
  userId,
  customerId,
  subscriptionId,
  subscriptionStatus,
  subscriptionCurrentPeriodEnd,
}) {
  const plan = resolvePlanFromSubscriptionStatus(subscriptionStatus);
  await query(
    `
      UPDATE users
      SET
        stripe_customer_id = COALESCE($1, stripe_customer_id),
        stripe_subscription_id = $2,
        subscription_status = $3,
        subscription_current_period_end = $4,
        plan = $5
      WHERE id = $6
    `,
    [customerId, subscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd, plan, userId]
  );
}

export const billingWebhookRouter = Router();

billingWebhookRouter.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !stripeWebhookSecret) {
      res.status(503).json({ error: "billing-webhook-not-configured" });
      return;
    }

    const signature = String(req.headers["stripe-signature"] || "");
    if (!signature) {
      res.status(400).json({ error: "missing-stripe-signature" });
      return;
    }

    let event = null;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (error) {
      res.status(400).json({ error: "invalid-stripe-signature", detail: error?.message || "" });
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const mode = String(session?.mode || "").toLowerCase();
        if (mode === "subscription") {
          const customerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id || null;
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id || null;
          const clientReferenceUserId = Number(
            session?.client_reference_id || session?.metadata?.userId || 0
          );

          let subscriptionStatus = "active";
          let subscriptionCurrentPeriodEnd = null;
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            subscriptionStatus = normalizeSubscriptionStatus(subscription?.status) || "active";
            subscriptionCurrentPeriodEnd = toIsoFromUnixTimestamp(subscription?.current_period_end);
          }

          if (customerId) {
            await updateSubscriptionByCustomerId({
              customerId,
              subscriptionId,
              subscriptionStatus,
              subscriptionCurrentPeriodEnd,
            });
          }
          if (Number.isFinite(clientReferenceUserId) && clientReferenceUserId > 0) {
            await updateSubscriptionByUserId({
              userId: clientReferenceUserId,
              customerId,
              subscriptionId,
              subscriptionStatus,
              subscriptionCurrentPeriodEnd,
            });
          }
        }
      }

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id || null;
        if (customerId) {
          const subscriptionId = String(subscription.id || "").trim() || null;
          const subscriptionStatus = normalizeSubscriptionStatus(subscription.status);
          const subscriptionCurrentPeriodEnd = toIsoFromUnixTimestamp(
            subscription.current_period_end
          );
          await updateSubscriptionByCustomerId({
            customerId,
            subscriptionId,
            subscriptionStatus,
            subscriptionCurrentPeriodEnd,
          });
        }
      }

      res.json({ received: true });
    } catch {
      res.status(500).json({ error: "billing-webhook-processing-failed" });
    }
  }
);

export const billingRouter = Router();

billingRouter.use(requireAuth);

billingRouter.get("/status", async (req, res) => {
  const userId = Number(req.authUser?.id || 0);
  try {
    const row = await findUserBillingInfoById(userId);
    res.json({
      plan: normalizePlan(row?.plan),
      subscriptionStatus: normalizeSubscriptionStatus(row?.subscription_status),
      currentPeriodEnd: row?.subscription_current_period_end || null,
      isStripeConfigured: Boolean(stripe && stripePriceId),
    });
  } catch {
    res.status(500).json({ error: "billing-status-failed" });
  }
});

billingRouter.post("/checkout-session", async (req, res) => {
  if (!ensureStripeCheckoutConfigured(res)) return;

  const userId = Number(req.authUser?.id || 0);
  try {
    const row = await findUserBillingInfoById(userId);
    if (!row) {
      res.status(404).json({ error: "user-not-found" });
      return;
    }
    if (!row.email) {
      res.status(400).json({ error: "email-required-for-billing" });
      return;
    }
    if (normalizePlan(row.plan) === "pro") {
      res.status(409).json({ error: "already-on-paid-plan" });
      return;
    }

    let customerId = String(row.stripe_customer_id || "").trim();
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: row.email,
        name: row.username || undefined,
        metadata: {
          userId: String(row.id),
        },
      });
      customerId = customer.id;
      await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, row.id]);
    }

    const appBaseUrl = getAppBaseUrl(req);
    const isFirstSubscriptionCheckout =
      !String(row.stripe_subscription_id || "").trim() &&
      !normalizeSubscriptionStatus(row.subscription_status);
    const shouldApplyTrial = stripeTrialDays > 0 && isFirstSubscriptionCheckout;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${appBaseUrl}/app?billing=success`,
      cancel_url: `${appBaseUrl}/app?billing=cancel`,
      client_reference_id: String(row.id),
      metadata: {
        userId: String(row.id),
      },
      allow_promotion_codes: true,
      ...(shouldApplyTrial
        ? {
            subscription_data: {
              trial_period_days: stripeTrialDays,
            },
          }
        : {}),
    });

    res.json({ url: checkoutSession.url });
  } catch {
    res.status(500).json({ error: "billing-checkout-session-failed" });
  }
});

billingRouter.post("/portal-session", async (req, res) => {
  if (!ensureStripePortalConfigured(res)) return;

  const userId = Number(req.authUser?.id || 0);
  try {
    const row = await findUserBillingInfoById(userId);
    const customerId = String(row?.stripe_customer_id || "").trim();
    if (!customerId) {
      res.status(400).json({ error: "billing-customer-missing" });
      return;
    }

    const appBaseUrl = getAppBaseUrl(req);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl}/app`,
    });

    res.json({ url: portalSession.url });
  } catch {
    res.status(500).json({ error: "billing-portal-session-failed" });
  }
});
