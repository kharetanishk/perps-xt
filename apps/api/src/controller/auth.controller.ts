import { Request, Response } from "express";
import { signInSchema, signUpSchema } from "../validation/schema";
import bcrypt from "bcryptjs";
import { prisma } from "@perps-xt/db";
import jwt from "jsonwebtoken";
import { config } from "../config/envConfig";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const parseD = signUpSchema.safeParse(req.body);
    if (!parseD.success) {
      const errors = parseD.error.flatten((e) => e.message).fieldErrors;
      return res.status(400).json({
        message: "Invalid credentials",
        error: errors,
      });
    }

    const { username, email, password } = parseD.data;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res.status(400).json({
        error:
          existingUser.email === email
            ? "Email already in use"
            : "Username already taken",
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { username, email, password: hashPassword },
      select: { id: true, email: true },
    });

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      config.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      message: "Signed up successfully",
      token,
    });
  } catch (e) {
    console.error("Error in signup controller:", e);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const parseD = signInSchema.safeParse(req.body);
    if (!parseD.success) {
      const errors = parseD.error.flatten((e) => e.message).fieldErrors;
      return res.status(400).json({ error: errors });
    }

    const { email, password } = parseD.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found, try signing up",
      });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid password",
      });
    }

    const token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      config.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      message: "Signed in successfully",
      token,
    });
  } catch (e) {
    console.error("Error in signin controller:", e);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
