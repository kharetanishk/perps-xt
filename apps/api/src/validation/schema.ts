import { z } from "zod";

const usernmameValidation = z
  .string()
  .min(3, "Username is too shorrt")
  .max(30, "Username is too long")
  .trim();

const passwordValdation = z
  .string()
  .min(5, " Password is too short")
  .regex(/1-10/, "Password should contain atleast one numerical value")
  .trim();

const emailValidation = z.string().email("invalid email ").trim();

export const signUpSchema = z.object({
  username: usernmameValidation,
  email: emailValidation,
  password: passwordValdation,
});

export const signInSchema = z.object({
  email: emailValidation,
  password: passwordValdation,
});
