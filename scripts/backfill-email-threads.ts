/**
 * One-time backfill: set subjectNorm + threadId on existing EmailMessage rows.
 * Walks messages oldest-first so replies attach to already-threaded parents.
 *
 * Run locally:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_local \
 *     npx tsx --tsconfig tsconfig.json scripts/backfill-email-threads.ts
 *
 * Run on prod data:
 *   DATABASE_URL=<prod url> npx tsx --tsconfig tsconfig.json scripts/backfill-email-threads.ts
 *
 * Note: this script uses relative imports from ../src/lib so that tsx can pick
 * up the @/* path alias (mapped to src/*) from tsconfig.json when resolving
 * transitive imports inside threading.ts.
 */
import { prisma } from "../src/lib/prisma";
import {
  extractEmails,
  normalizeSubject,
  prismaThreadFinders,
  resolveThreadId,
} from "../src/lib/email/threading";

async function main() {
  const finders = prismaThreadFinders();
  let processed = 0;
  for (;;) {
    const batch = await prisma.emailMessage.findMany({
      where: { threadId: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        direction: true,
        subject: true,
        fromAddress: true,
        toAddresses: true,
        inReplyTo: true,
        createdAt: true,
      },
    });
    if (batch.length === 0) break;
    for (const m of batch) {
      const counterparty =
        m.direction === "INBOUND"
          ? extractEmails(m.fromAddress)
          : extractEmails(m.toAddresses);
      const threadId =
        (await resolveThreadId(
          {
            inReplyTo: m.inReplyTo,
            subject: m.subject,
            counterpartyEmails: counterparty,
          },
          finders,
          m.createdAt,
        )) ?? m.id;
      await prisma.emailMessage.update({
        where: { id: m.id },
        data: { threadId, subjectNorm: normalizeSubject(m.subject) },
      });
      processed += 1;
    }
    console.log(`threaded ${processed} messages...`);
  }
  console.log(`Done. ${processed} messages threaded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
