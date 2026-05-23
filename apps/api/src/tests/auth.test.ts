import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";

describe("POST /api/v2/auth/register", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/api/v2/auth/register").send({
      username: "testuser",
      email: "test@gmail.com",
      password: "test123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.message).toBe("Signed up successfully");
  });

  it("should fail if user already exists", async () => {
    const res = await request(app).post("/api/v2/auth/register").send({
      username: "testuser",
      email: "test@gmail.com",
      password: "test123",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("should fail with invalid body", async () => {
    const res = await request(app)
      .post("/api/v2/auth/register")
      .send({ email: "notvalid" }); // missing username, password

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v2/auth/login", () => {
  it("should login successfully", async () => {
    const res = await request(app).post("/api/v2/auth/login").send({
      email: "test@gmail.com",
      password: "test123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail with wrong password", async () => {
    const res = await request(app).post("/api/v2/auth/login").send({
      email: "test@gmail.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("should fail if user doesn't exist", async () => {
    const res = await request(app).post("/api/v2/auth/login").send({
      email: "ghost@gmail.com",
      password: "test123",
    });

    expect(res.status).toBe(404);
  });
});
