/**
 * Contract template management. GET lists the categorized templates + upload
 * status; POST uploads/replaces the .docx for one category.
 */
import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, listTemplates, saveTemplate, type ContractCategory } from "@/lib/contracts/templates";

export async function GET() {
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const category = String(form.get("category") ?? "") as ContractCategory;
    const file = form.get("file");
    if (!CATEGORIES.some((c) => c.key === category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No .docx file uploaded" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Template must be a .docx file" }, { status: 400 });
    }
    await saveTemplate(category, Buffer.from(await file.arrayBuffer()), file.name);
    return NextResponse.json({ ok: true, templates: await listTemplates() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
