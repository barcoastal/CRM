import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePaymentSchema } from "@/lib/validations/payment";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, paymentId } = await params;

  try {
    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify payment exists and belongs to this client
    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, clientId: id },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (data.status !== undefined) {
      updateData.status = data.status;

      // When status changes to COMPLETED, auto-set paidDate to now if not provided
      if (
        data.status === "COMPLETED" &&
        existingPayment.status !== "COMPLETED"
      ) {
        updateData.paidDate = data.paidDate ? new Date(data.paidDate) : new Date();
      }

      // When status changes to MISSED, don't change paidDate
      // (no special handling needed - just don't set it)
    }

    // If paidDate is explicitly provided (and we haven't already set it above)
    if (data.paidDate !== undefined && updateData.paidDate === undefined) {
      updateData.paidDate = data.paidDate ? new Date(data.paidDate) : null;
    }

    if (data.reference !== undefined) {
      updateData.reference = data.reference || null;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes || null;
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        debt: {
          select: { creditorName: true },
        },
      },
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }
}
