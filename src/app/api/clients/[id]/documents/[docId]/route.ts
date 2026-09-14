import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) {
    return ssnSafeJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, docId } = await params;

  const document = await prisma.document.findFirst({
    where: { id: docId, clientId: id },
  });

  if (!document) {
    return ssnSafeJson({ error: "Document not found" }, { status: 404 });
  }

  await prisma.document.delete({ where: { id: docId } });

  return ssnSafeJson({ success: true });
}
