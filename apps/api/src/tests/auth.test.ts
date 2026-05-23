import { beforeAll, describe, it, expect } from "vitest";
import { prisma } from "@perps-xt/db";
import request from "supertest";
import app from "../app";

beforeAll(async () => {
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: "test@gmail.com" }, { username: "testuser" }],
    },
  });
});

describe("POST /api/v2/auth/signup", () => {
  it("should register a new user", async () => {
    const res = await request(app).post("/api/v2/auth/signup").send({
      username: "testuser",
      email: "test@gmail.com",
      password: "test123",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.message).toBe("Signed up successfully");
  });

  it("should fail if user already exists", async () => {
    const res = await request(app).post("/api/v2/auth/signup").send({
      username: "testuser",
      email: "test@gmail.com",
      password: "test123",
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("should fail with invalid body", async () => {
    const res = await request(app)
      .post("/api/v2/auth/signup")
      .send({ email: "notvalid" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v2/auth/signin", () => {
  it("should login successfully", async () => {
    const res = await request(app).post("/api/v2/auth/signin").send({
      email: "test@gmail.com",
      password: "test123",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail with wrong password", async () => {
    const res = await request(app).post("/api/v2/auth/signin").send({
      email: "test@gmail.com",
      password: "wrongpassword1",
    });
    console.log("STATUS:", res.status);
    console.log("BODY:", res.body);
    expect(res.status).toBe(401);
  });

  it("should fail if user doesn't exist", async () => {
    const res = await request(app).post("/api/v2/auth/signin").send({
      email: "ghost@gmail.com",
      password: "test123",
    });
    expect(res.status).toBe(404);
  });
});
