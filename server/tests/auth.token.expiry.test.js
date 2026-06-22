import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../db/client.js", () => ({
  query: mockQuery,
}));

describe("requireAuth token expiry", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.resetModules();
    process.env.AUTH_TOKEN_MAX_AGE_DAYS = "30";
  });

  it("returns 401 expired-auth-token for stale tokens", async () => {
    const staleDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 42, username: "tester", plan: "free", auth_token_created_at: staleDate }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const { requireAuth } = await import("../middleware/auth.js");

    const req = { headers: { authorization: "Bearer stale-token" } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "expired-auth-token" });
    expect(next).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET auth_token = NULL, auth_token_created_at = NULL WHERE id = $1 AND auth_token = $2",
      [42, "stale-token"]
    );
  });

  it("uses a valid session cookie when the bearer token is invalid", async () => {
    const freshDate = new Date().toISOString();
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            username: "tester",
            plan: "free",
            lifetime_pro: false,
            role: "user",
            auth_token_created_at: freshDate,
          },
        ],
      });

    const { requireAuth } = await import("../middleware/auth.js");

    const req = {
      headers: {
        authorization: "Bearer stale-local-token",
        cookie: "vocab_session=fresh-cookie-token",
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authToken).toBe("fresh-cookie-token");
    expect(req.authUser).toMatchObject({ id: 42, username: "tester", plan: "free" });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("uses a valid session cookie when the bearer token is expired", async () => {
    const staleDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date().toISOString();
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 41,
            username: "old_tester",
            plan: "free",
            lifetime_pro: false,
            role: "user",
            auth_token_created_at: staleDate,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            username: "tester",
            plan: "pro",
            lifetime_pro: true,
            role: "user",
            auth_token_created_at: freshDate,
          },
        ],
      });

    const { requireAuth } = await import("../middleware/auth.js");

    const req = {
      headers: {
        authorization: "Bearer expired-local-token",
        cookie: "vocab_session=fresh-cookie-token",
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authToken).toBe("fresh-cookie-token");
    expect(req.authUser).toMatchObject({ id: 42, username: "tester", plan: "pro", isLifetimePro: true });
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET auth_token = NULL, auth_token_created_at = NULL WHERE id = $1 AND auth_token = $2",
      [41, "expired-local-token"]
    );
  });
});
