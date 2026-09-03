import { Redis } from '@upstash/redis';

// Upstash's REST client talks over plain HTTPS instead of a long-lived TCP
// connection, which is exactly why it works inside stateless serverless
// functions where a normal Redis client (or an in-memory Go channel) can't
// survive between requests.
export const redis = Redis.fromEnv();
