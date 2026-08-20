CREATE TABLE "AiAuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAuditLog_requestId_key" ON "AiAuditLog"("requestId");
CREATE INDEX "AiAuditLog_userId_createdAt_idx" ON "AiAuditLog"("userId", "createdAt");
CREATE INDEX "AiAuditLog_action_createdAt_idx" ON "AiAuditLog"("action", "createdAt");

ALTER TABLE "AiAuditLog"
ADD CONSTRAINT "AiAuditLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
