import { config } from "dotenv";
config();

async function testConnection() {
  console.log("=========================================");
  console.log("   UPSTASH / REDIS CONNECTION TEST       ");
  console.log("=========================================\n");

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

  console.log("Checking Environment Variables:");
  console.log("  UPSTASH_REDIS_REST_URL  :", restUrl ? `${restUrl.substring(0, 20)}...` : "(not set)");
  console.log("  UPSTASH_REDIS_REST_TOKEN:", restToken ? `${restToken.substring(0, 8)}...` : "(not set)");
  console.log("  REDIS_URL               :", redisUrl ? `${redisUrl.split("@")[0].substring(0, 15)}...` : "(not set)");
  console.log("");

  if (restUrl && restToken) {
    console.log("--> Testing via @upstash/redis (HTTP REST)...");
    try {
      const { Redis } = await import("@upstash/redis");
      const upstash = new Redis({ url: restUrl, token: restToken });
      
      const ping = await upstash.ping();
      console.log("  [SUCCESS] Ping response:", ping);

      const testKey = `test:upstash:${Date.now()}`;
      await upstash.set(testKey, { hello: "world", timestamp: Date.now() }, { ex: 60 });
      console.log("  [SUCCESS] SET test key:", testKey);

      const val = await upstash.get(testKey);
      console.log("  [SUCCESS] GET test key returned:", val);

      await upstash.del(testKey);
      console.log("  [SUCCESS] DEL test key clean.");
      console.log("\n>>> UPSTASH REST REDIS IS WORKING 100%! <<<\n");
      return;
    } catch (err) {
      console.error("  [ERROR] Upstash REST connection failed:", err.message);
    }
  }

  if (redisUrl) {
    console.log("--> Testing via ioredis (TCP / rediss://)...");
    try {
      const { default: Redis } = await import("ioredis");
      const isTls = redisUrl.startsWith("rediss://");
      const client = new Redis(redisUrl, {
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        enableOfflineQueue: false,
      });

      const ping = await client.ping();
      console.log("  [SUCCESS] Ping response:", ping);

      const testKey = `test:ioredis:${Date.now()}`;
      await client.set(testKey, JSON.stringify({ hello: "world" }), "EX", 60);
      console.log("  [SUCCESS] SET test key:", testKey);

      const val = await client.get(testKey);
      console.log("  [SUCCESS] GET test key returned:", val);

      await client.del(testKey);
      console.log("  [SUCCESS] DEL test key clean.");
      await client.quit();
      console.log("\n>>> REDIS TCP (IOREDIS) IS WORKING 100%! <<<\n");
      return;
    } catch (err) {
      console.error("  [ERROR] Redis TCP connection failed:", err.message);
    }
  }

  console.log("\n[!] No valid Redis credentials found in .env.");
  console.log("Please add either:");
  console.log("  UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
  console.log("  OR");
  console.log("  REDIS_URL=rediss://default:password@host:port\n");
}

testConnection();

