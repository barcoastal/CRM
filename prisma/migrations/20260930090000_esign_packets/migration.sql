CREATE TABLE "SigningPacket" (
 "id" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'DRAFT', "name" TEXT NOT NULL,
 "createdById" TEXT NOT NULL, "opportunityId" TEXT, "config" JSONB NOT NULL DEFAULT '{}',
 "preparedPdfPath" TEXT NOT NULL, "completedPdfPath" TEXT, "revision" INTEGER NOT NULL DEFAULT 1,
 "lastReminderAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SigningPacket_createdById_status_idx" ON "SigningPacket"("createdById","status");
ALTER TABLE "Envelope" ADD COLUMN "packetId" TEXT, ADD COLUMN "routingOrder" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_packetId_fkey" FOREIGN KEY("packetId") REFERENCES "SigningPacket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Envelope_packetId_idx" ON "Envelope"("packetId");

ALTER TABLE "Account" ADD COLUMN "billingCounty" TEXT;

ALTER TABLE "SigningPacket" ADD COLUMN "completedDeliveryAt" TIMESTAMP(3);
