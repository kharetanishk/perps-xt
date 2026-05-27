import { v4 as uuid } from "uuid";
import { createRedisClient, lpush, brpop, QUEUES } from "@perps-xt/redis";
import type {
  EngineRequest,
  EngineResponse,
  EngineRequestType,
} from "@perps-xt/types";

// unique ID for this API instance
// if we run 3 API servers, each has its own responseQueue
// engine replies to the correct one
const INSTANCE_ID = uuid();
const RESPONSE_QUEUE = `response-queue-${INSTANCE_ID}`;

// two separate clients
// one for sending (lpush)
// one for receiving (brpop — blocks, so needs dedicated connection)
const sender = createRedisClient();
const receiver = createRedisClient();

const TIMEOUT_MS = 5;

export async function sendToEngine(
  type: EngineRequestType,
  userId: string,
  payload: Record<string, unknown>,
): Promise<EngineResponse> {
  const correlationId = uuid();

  const request: EngineRequest = {
    correlationId,
    responseQueue: RESPONSE_QUEUE,
    type,
    userId,
    payload,
  };

  // send to engine
  await lpush(sender, QUEUES.ENGINE_REQUESTS, request);

  // wait for response with timeout
  // brpop with timeout=5 waits max 5 seconds then returns null
  const response = await brpop<EngineResponse>(
    receiver,
    RESPONSE_QUEUE,
    TIMEOUT_MS,
  );

  if (!response) {
    throw new Error("Engine timeout — no response in 5 seconds");
  }

  // verify this response is for our request
  // (defensive check — should always match since queue is private)
  if (response.correlationId !== correlationId) {
    throw new Error("Correlation ID mismatch");
  }

  return response;
}
