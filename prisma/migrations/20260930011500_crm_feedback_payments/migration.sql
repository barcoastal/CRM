-- AlterTable
ALTER TABLE "OpportunityPaymentCalculation" ADD COLUMN     "scheduleJson" JSONB;

-- CreateTable
CREATE TABLE "WirePayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "programPlanId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "wireFee" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "wireType" TEXT NOT NULL DEFAULT 'Regular',
    "legalFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WirePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WirePayment_draftId_key" ON "WirePayment"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "WirePayment_requestKey_key" ON "WirePayment"("requestKey");

-- CreateIndex
CREATE INDEX "WirePayment_accountId_receivedAt_idx" ON "WirePayment"("accountId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WirePayment_accountId_reference_key" ON "WirePayment"("accountId", "reference");

-- AddForeignKey
ALTER TABLE "WirePayment" ADD CONSTRAINT "WirePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirePayment" ADD CONSTRAINT "WirePayment_programPlanId_fkey" FOREIGN KEY ("programPlanId") REFERENCES "ProgramPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirePayment" ADD CONSTRAINT "WirePayment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
