import type { Product } from "@/data/products";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { createProduct } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const body = await readBody<Partial<Product>>(request);
    return ok(await createProduct(body, "Admin (admin@skywear.in)"), 201);
  } catch (error) {
    return fail(error);
  }
}
