import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MsTitleBar } from "../title-bar";
import { PersonalInfoForm, type PersonalInfoValues } from "./personal-info-form";

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
}

function buildUsername(user: { id: string; email: string }): string {
  // SF-style read-only username "User<digits>@coastaldebt.com"
  const digits = (user.id.match(/\d+/g)?.join("") ?? "").slice(0, 6).padStart(6, "0");
  return `User${digits}@coastaldebt.com`;
}

export default async function PersonalInformationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      middleName: true,
      suffix: true,
      alias: true,
      nickname: true,
      title: true,
      companyDisplay: true,
      department: true,
      division: true,
      extension: true,
      fax: true,
      mobile: true,
      country: true,
      street: true,
      city: true,
      state: true,
      postalCode: true,
    },
  });

  if (!user) redirect("/login");

  const { first, last } = splitName(user.name ?? "");

  const initial: PersonalInfoValues = {
    firstName: first,
    middleName: user.middleName ?? "",
    lastName: last,
    suffix: user.suffix ?? "",
    alias: user.alias ?? "",
    email: user.email,
    username: buildUsername(user),
    nickname: user.nickname ?? "",
    title: user.title ?? "",
    companyDisplay: user.companyDisplay ?? "Coastal Debt",
    department: user.department ?? "",
    division: user.division ?? "",
    extension: user.extension ?? "",
    fax: user.fax ?? "",
    mobile: user.mobile ?? "",
    country: user.country ?? "United States",
    street: user.street ?? "",
    city: user.city ?? "",
    state: user.state ?? "",
    postalCode: user.postalCode ?? "",
  };

  return (
    <>
      <MsTitleBar title="Personal Information" />
      <div className="ms-banner">
        Salesforce now sends emails only from verified domains. To avoid delivery failures,
        verify your email domain or enable your subdomain email sending domain.{" "}
        <Link href="https://help.salesforce.com" target="_blank" rel="noreferrer">
          Learn More
        </Link>
      </div>
      <div className="ms-body">
        <PersonalInfoForm initial={initial} />
      </div>
    </>
  );
}
