// Auth admin đơn giản: 1 mật khẩu chung (env ADMIN_PASSWORD, mặc định "admin123").
// Cookie httpOnly chứa token suy từ mật khẩu. Đủ cho demo hackathon.
import { cookies } from "next/headers";

export const COOKIE_NAME = "vstage_admin";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}
export function tokenFor(pw) {
  return Buffer.from("vstage:" + pw).toString("base64");
}
export async function isAuthed() {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  return !!v && v === tokenFor(adminPassword());
}
