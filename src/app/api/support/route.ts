import { connection } from "next/server";
import { fail, ok } from "@/lib/http";
import { supportSnapshot } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function GET() {
  try {
    await connection();
    await ensureStateLoaded();
    return ok(supportSnapshot());
  } catch (error) {
    return fail(error);
  }
}
