import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/envConfig";

interface JwtPayload {
  userId: string;
  email: string;
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized, please log in" });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized, please log in",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    req.userId = decoded.userId;
    next();
  } catch (e) {
    console.error("Error in auth middleware:", e);
    if (e instanceof jwt.TokenExpiredError) {
      return res
        .status(401)
        .json({ error: "Token expired, please log in again" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}
