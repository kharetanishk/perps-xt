import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";

let token: string; // ← shared across tests in this file

beforeAll(async () => {
  // login first to get token
  const res = await request(app)
    .post("/api/v2/auth/login")
    .send({ email: "test@gmail.com", password: "test123" });

  token = res.body.token;
});

describe("GET /api/v2/user/me", () => {
  it("should return user info", async () => {
    const res = await request(app)
      .get("/api/v2/user/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("username");
    expect(res.body.user).not.toHaveProperty("password"); // ← security check
  });

  it("should fail without token", async () => {
    const res = await request(app).get("/api/v2/user/me");

    expect(res.status).toBe(401);
  });

  it("should fail with invalid token", async () => {
    const res = await request(app)
      .get("/api/v2/user/me")
      .set("Authorization", "Bearer faketoken123");

    expect(res.status).toBe(401);
  });
});
