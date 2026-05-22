import { Request, Response } from "express";
import { signUpSchema } from "../validation/schema";
import bcrypt from "bcryptjs";
import { parse } from "dotenv";
import prisma from "@perps-xt/db";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const parseD = signUpSchema.safeParse(req.body);
    if (!parseD.success) {
      const errors = parseD.error.flatten((issue) => issue.message).fieldErrors;
      return res.status(400).json({
        error: errors,
      });
    }

    const { username, email, password } = {
      username: parseD.data?.username,
      email: parseD.data?.email,
      password: parseD.data?.password,
    };

    const exisitingUser = await
  } catch (error) {}
};
