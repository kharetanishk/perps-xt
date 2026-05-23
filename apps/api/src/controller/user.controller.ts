import { prisma } from "@perps-xt/db";
import { Request, Response } from "express";

export const getUserInfo = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: `user not found , login again `,
      });
    }

    return res.status(200).json({
      message: `welcome ${user.username}`,
      user: user,
    });
  } catch (err) {
    console.log(`error in the user controller  ${err}`);
    return res.status(500).json({
      message: `something went wrong `,
    });
  }
};
