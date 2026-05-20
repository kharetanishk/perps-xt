import Redis from "ioredis";

export function createRedisClient(): Redis {
  const client = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null,
  });

  client.on("connect", () => console.log("[redis] connected"));
  client.on("error", (err) => console.error("[redis] error:", err.message));

  return client;
}

export async function lpush<T>(
  client: Redis,
  queue: string,
  message: T,
): Promise<void> {
  await client.lpush(queue, JSON.stringify(message));
}

export async function brpop<T>(
  client: Redis,
  queue: string,
  timeout: number = 0,
): Promise<T | null> {
  const result = await client.brpop(queue, timeout); //if timeot 0  , then it means "blocks forever , wakes up instantly a message arrives"
  if (!result) return null;
  return JSON.parse(result[1]) as T; //result is an array[queueName , vlue] the value is in 1st index
}

export async function publish<T>(
  client: Redis,
  channel: string,
  message: T,
): Promise<void> {
  await client.publish(channel, JSON.stringify(message));
}

export function subscribe<T>(
  client: Redis,
  channel: string,
  handler: (message: T) => void,
): void {
  client.subscribe(channel, (err) => {
    if (err) {
      console.error(`[redis] failed to subscribe to ${channel}:`, err.message);
      return;
    }
    console.log(`[redis] subscribed to: ${channel}`);
  });

  client.on("message", (receivedChannel, rawMessage) => {
    if (receivedChannel !== channel) return;
    try {
      handler(JSON.parse(rawMessage) as T);
    } catch {
      console.error(`[redis] bad message on ${channel}:`, rawMessage);
    }
  });
}

export const QUEUES = {
  ENGINE_REQUESTS: "backend-to-engine-broker",
  DB_WRITES: "db-writes-queue",
} as const;

export const CHANNELS = {
  PRICE: "price",
  FILLS: "fills",
  DEPTH: "depth",
} as const;
