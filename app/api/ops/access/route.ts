import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const configured = process.env.OPS_ACCESS_KEY;
  const key = new URL(req.url).searchParams.get("key");

  if (!configured || !key || key !== configured) {
    return new Response("Not found", { status: 404 });
  }

  const jar = await cookies();
  jar.set("atlas_ops", configured, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/control",
  });

  return Response.redirect(new URL("/control", req.url), 302);
}
