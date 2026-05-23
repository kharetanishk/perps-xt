import { Request, Response } from "express";
import { signInSchema, signUpSchema } from "../validation/schema";
import bcrypt from "bcryptjs";
import { prisma } from "@perps-xt/db";
import jwt from "jsonwebtoken";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const parseD = signUpSchema.safeParse(req.body);
    if (!parseD.success) {
      const errors = parseD.error.flatten((e) => e.message).fieldErrors;
      return res.status(400).json({
        messgae: `invalid credentials`,
        error: errors,
      });
    }
    const { username, email, password } = {
      username: parseD.data?.username.trim(),
      email: parseD.data?.email.trim(),
      password: parseD.data?.password.trim(),
    };

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: `User already exist try Signning in`,
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: hashPassword,
      },
    });
    const JWT_SECRET = process.env.JWT_SECRET as string;
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.status(200).json({
      message: `sign up successfully`,
      token: token,
    });
  } catch (e) {
    console.log(`error in the signup controller ${e}`);
    return res.status(500).json({
      error: `something went wrong`,
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const parseD = signInSchema.safeParse(req.body);
    if (!parseD.success) {
      const errors = parseD.error.flatten((e) => e.message).fieldErrors;
      return res.status(400).json({
        error: errors,
      });
    }

    const { email, password } = {
      email: parseD.data?.email,
      password: parseD.data?.password,
    };

    const exisitingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!exisitingUser) {
      return res.status(400).json({
        messsage: `User dont exist , try signing up `,
      });
    }

    const isMatch = await bcrypt.compare(password, exisitingUser.password);

    if (!isMatch) {
      return res.status(400).json({
        error: `invalid password`,
      });
    }
    const JWT_SECRET = process.env.JWT_SECRET as string;
    const token = jwt.sign(
      {
        userId: exisitingUser.id,
        email: exisitingUser.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.status(200).json({
      message: `user signned In successfully`,
      token: token,
    });
  } catch (e) {
    console.log(`error in the signIn controller :  ${e}`);
    return res.status(500).json({
      message: `something went wrong`,
    });
  }
};
