import { NextResponse } from "next/server";
import { adminPassword, tokenFor, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let password = "";
  try {
    ({ password } = await req.json());
  } catch {}
  if (password !== adminPassword()) {
    return NextResponse.json({ ok: false, error: "Sai mật khẩu" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
