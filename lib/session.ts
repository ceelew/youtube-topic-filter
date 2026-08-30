import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { env } from "@/lib/env";

export interface SessionData {
  isAdmin?: boolean;
}

const sessionOptions = {
  cookieName: "ytf_admin_session",
  password: env.SESSION_SECRET,
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Throws if the current request doesn't have an authenticated admin session.
 *  Call this at the top of every admin Server Action — per Next.js guidance, page-level
 *  gating alone isn't enough because Server Actions are independently reachable endpoints. */
export async function requireAdminSession(): Promise<void> {
  const session = await getSession();
  if (!session.isAdmin) {
    throw new Error("Not authenticated");
  }
}
