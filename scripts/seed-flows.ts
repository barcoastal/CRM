/**
 * Optional Flow seed. Idempotent: only creates a demo flow if no flows exist.
 *
 * Run:  DATABASE_URL=... npx tsx scripts/seed-flows.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { emptyGraph } from "../src/lib/flow/nodes";
import type { FlowGraph } from "../src/lib/flow/nodes";

async function main() {
  const count = await prisma.flow.count();
  if (count > 0) {
    console.log(`Flows already exist (${count}). Skipping seed.`);
    return;
  }

  const empty = emptyGraph();
  const graph: FlowGraph = {
    nodes: [
      empty.nodes[0], // start
      {
        id: "send_welcome",
        kind: "send_email",
        label: "Send welcome email",
        position: { x: 280, y: 200 },
        config: {
          templateId: "",
          subject: "Welcome to Coastal Debt, {{name}}",
          body: "Hi {{name}}, your account is now Active. Let us know if you need anything.",
          toFieldPath: "email",
        },
      },
      empty.nodes[1], // end
    ],
    edges: [
      { id: "e1", source: "start", target: "send_welcome" },
      { id: "e2", source: "send_welcome", target: "end" },
    ],
  };

  await prisma.flow.create({
    data: {
      name: "Send welcome email when new Account becomes Active",
      description: "Demo flow seeded on first run. Fires on Account UPDATE when stage becomes Active.",
      entityType: "Account",
      triggerEvent: "UPDATE",
      isActive: false,
      triggerOnFieldChanges: ["stage"] as object,
      entryCriteria: {
        kind: "and",
        conditions: [{ field: "stage", operator: "equals", value: "Active" }],
      } as object,
      graph: graph as unknown as object,
    },
  });
  console.log("Seeded demo flow.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
