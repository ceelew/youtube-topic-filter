import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function getAuthState() {
  return prisma.adminAuthState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/** Password check with a DB-backed lockout (survives across serverless instances).
 *  After MAX_ATTEMPTS consecutive failures, blocks all attempts for LOCKOUT_MS. */
export async function attemptAdminLogin(password: string): Promise<LoginResult> {
  const state = await getAuthState();

  if (state.lockedUntil && state.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((state.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Too many failed attempts. Try again in ${minutesLeft} min.` };
  }

  const valid = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);

  if (!valid) {
    const failedAttempts = state.failedAttempts + 1;
    const lockedUntil = failedAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
    await prisma.adminAuthState.update({
      where: { id: "singleton" },
      data: { failedAttempts, lockedUntil },
    });
    return { ok: false, error: "Incorrect password." };
  }

  await prisma.adminAuthState.update({
    where: { id: "singleton" },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  return { ok: true };
}
