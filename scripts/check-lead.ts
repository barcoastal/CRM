import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const leads = await prisma.lead.findMany({
    where: { sfDataJson: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { assignedTo: { select: { name: true, email: true } } },
  });
  for (const lead of leads) {
    console.log("---");
    console.log("CRM id:", lead.id);
    console.log("Last 8 of id:", lead.id.slice(-8).toUpperCase());
    console.log("sfId:", lead.sfId);
    console.log("contactName:", lead.contactName);
    console.log("businessName:", lead.businessName);
    console.log("assignedTo:", lead.assignedTo);
    try {
      const j = JSON.parse(lead.sfDataJson ?? "{}");
      console.log("Owner_Full_Name__c:", j.Owner_Full_Name__c);
      console.log("Owner_Username__c:", j.Owner_Username__c);
      console.log("FirstName:", j.FirstName);
      console.log("LastName:", j.LastName);
      console.log("Salutation:", j.Salutation);
      console.log("Title:", j.Title);
      console.log("Phone:", j.Phone);
      console.log("Company:", j.Company);
      console.log("Industry:", j.Industry);
      console.log("Has_Multiple_MCA_s__c:", j.Has_Multiple_MCA_s__c, typeof j.Has_Multiple_MCA_s__c);
      console.log("Call_counter__c:", j.Call_counter__c);
      console.log("Hopper_Priority__c:", j.Hopper_Priority__c);
      console.log("DNC__c:", j.DNC__c);
      console.log("Total keys:", Object.keys(j).length);
    } catch (e) {
      console.log("JSON parse error:", (e as Error).message);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
