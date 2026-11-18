import type { Product } from "@/data/products";
import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { archiveProduct, updateProduct, purgeProduct } from "@/lib/server/services";
import { ensureStateLoaded } from "@/lib/server/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const { id } = await params;
    const body = await readBody<Partial<Product>>(request);
    return ok(await updateProduct(id, body, "Admin (admin@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin login required");
    await ensureStateLoaded();
    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";
    if (permanent) {
      return ok(await purgeProduct(id, "Admin (admin@skywear.in)"));
    }
    return ok(await archiveProduct(id, "Admin (admin@skywear.in)"));
  } catch (error) {
    return fail(error);
  }
}
