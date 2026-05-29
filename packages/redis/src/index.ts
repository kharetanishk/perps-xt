import Redis from "ioredis";

export function createRedisClient(): Redis {
  const client = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
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

export const STREAMS = {
  INCOMING: "incoming-stream",
  RESPONSE: "response-stream",
} as const;

export const GROUPS = {
  ENGINE: "engine-group",
} as const;

export const CHANNELS = {
  PRICE: "price",
  FILLS: "fills",
  DEPTH: "depth",
} as const;

export async function createConsumerGroup(
  client: Redis,
  stream: string,
  group: string,
  startFrom: string = "$",
): Promise<void> {
  try {
    await client.xgroup("CREATE", stream, group, startFrom, "MKSTREAM");
  } catch (err: unknown) {
    if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }
}

export async function xadd(
  client: Redis,
  stream: string,
  message: unknown,
): Promise<string> {
  const id = await client.xadd(stream, "*", "data", JSON.stringify(message));
  return id!;
}

export async function xreadOne<T>(
  client: Redis,
  stream: string,
  group: string,
  consumer: string,
): Promise<{ id: string; data: T } | null> {
  const results = (await (client as Redis & {
    xreadgroup: (...args: string[]) => Promise<unknown>;
  }).xreadgroup(
    "GROUP",
    group,
    consumer,
    "COUNT",
    "1",
    "BLOCK",
    "0",
    "STREAMS",
    stream,
    ">",
  )) as [string, [string, string[]][]][] | null;

  if (!results || results.length === 0) return null;
  const [, entries] = results[0]!;
  const [id, fields] = entries[0]!;
  const dataIndex = fields.indexOf("data");
  const raw = fields[dataIndex + 1]!;
  return { id, data: JSON.parse(raw) as T };
}

export async function xack(
  client: Redis,
  stream: string,
  group: string,
  id: string,
): Promise<void> {
  await client.xack(stream, group, id);
}
