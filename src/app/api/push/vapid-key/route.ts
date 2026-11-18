import { ok } from "@/lib/http";
import { getVapidPublicKey } from "@/lib/server/webpush";

export async function GET() {
  return ok({
    publicKey: getVapidPublicKey(),
  });
}
