-- CreateTable
CREATE TABLE "AdminAuthState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "AdminAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshLog" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results" JSONB NOT NULL,

    CONSTRAINT "RefreshLog_pkey" PRIMARY KEY ("id")
);
