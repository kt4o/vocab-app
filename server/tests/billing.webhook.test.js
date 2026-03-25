import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";

const mockQuery = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req, _res, next) => next(),
}));

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
  });

  it("rejects missing stripe signature", async () => {
    const { billingWebhookRouter } = await import("../routes/billing.js");
    const app = createTestApp("/api/billing/webhook", billingWebhookRouter, { useJson: false });

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("content-type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "missing-stripe-signature" });
  });

  it("rejects invalid stripe signature", async () => {
    const { billingWebhookRouter } = await import("../routes/billing.js");
    const app = createTestApp("/api/billing/webhook", billingWebhookRouter, { useJson: false });

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "t=123,v1=invalid")
      .send(JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid-stripe-signature");
  });
});
