const requireEnvVars = {
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
} as const;

for (const [key, value] of Object.entries(requireEnvVars)) {
  if (!value) throw new Error(`Missing env vars of ${key}`);
}

export const config = requireEnvVars as Record<
  keyof typeof requireEnvVars,
  string
>;
