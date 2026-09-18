/** Audited against the signed-in Leads menu and filter panels on 2026-09-18.
 * Filters are ANDed, including Shared Leads' explicit `1 AND 2` logic.
 * These are list definitions, never authorization rules.
 */
export interface LeadListDefinition {
  value: string;
  label: string;
  scope: 'all' | 'my' | 'recent' | 'closer-pool';
  filters: string[];
}
const open = 'Lead Status not equal to Archive Disposition';
const sources = 'Lead Source equals Web, Social, Google, Webform, Affiliate, Organic, Broker Lead, Calendly, TB, Organic M';
const creators = 'Created By Alias equals bbizc, wLead, treye, AMupp';
const definitions: Array<[string, string[], LeadListDefinition['scope']?]> = [
  ['Recently Viewed', [], 'recent'], ['All Leads', []], ['My Leads', [open], 'my'],
  ['Web Leads', ['Lead Source Category equals Web']],
  ['All Transferred Web Leads', ['Lead Source Category equals Web Lead']],
  ['Calendly Leads', ['Lead Record Type equals Business', 'Created Date equals LAST 7 DAYS', 'Lead Source equals Calendly']],
  ['Closer Pool', ['Lead Record Type equals Business'], 'closer-pool'],
  ['Copy of Web Leads - Archived', ['Lead Status equals Archive Disposition', 'Sub Disposition equals Bad State']],
  ['Direct Mail Leads', ['Lead Source equals Direct Mail']],
  ['Lawsuit Leads', ['Lead Source equals LawSuit']],
  ['Leads for Survey', ['Lead Status equals Archive Disposition',
    'Owner First Name equals Craig, Christopher, Kevin, James, Juan, Gonzalo, Lavell, Jake',
    'Owner Last Name equals Cohen, Ayala, Price, Boulahanis, Crone, Limongi, Gelnik, Caliph, Reed, Salinas',
    "Sub Disposition equals Can't afford the program, Can't Save Weekly, Debt too new, Enrolled with another company, Looking for a loan, Lowered Payments with Lenders, Not Enough Debt, Not Interested - High UCC Risk, Not Interested Qualified, Payments are sustainable"]],
  ['My Team Leads', [open, 'Owner Last Name equals Cohen, Ayala, Price, Boulahanis, Limongi, Caliph, Reed, Medina, Michaels, Khouri, Gianfortune, Correia, Graziano, Garcia, Rosenthal, Elkayam']],
  ['My Unread Leads', ['Unread By Owner equals True'], 'my'],
  ['NO Ad Click Ids', ['Lead Source Category equals Web', 'Ad Click Id equals ', 'Created Date equals TODAY']],
  ['Pmax Lead Source', ['Lead Vendor Id Text equals Pmax']],
  ['Recently Viewed Leads', [], 'recent'],
  ['Shared Leads', ['five9 Disposition equals NOT ENOUGH DEBT', 'Last Modified Date equals TODAY']],
  ['Tatiana Web leads', [open, 'Owner Last Name equals Reyes']],
  ['Todays Web Leads', [sources, creators, 'Created Date equals TODAY']],
  ['Un-Assigned Web Leads', ['Lead Record Type equals Business, Pre Lead',
    'Owner Username equals nathanm@coastaldebt.com, amuppidi@yatitechnology.com',
    'Lead Status not equal to Archive Disposition, Converted', creators, sources, 'Ad Click Id not equal to ']],
  ['UTM Search', [open, 'UTM Term not equal to ', 'Created Date greater than 1/1/2024']],
  ['Web Leads Archive', ['Name contains New Splashpage Inbound', 'Lead Record Type equals Business']],
  ['Web Leads IB', ['Lead Source equals IB - Google, IB - Social, IB - Youtube, IB - Bing, IB - Debtco, IB - Organic M', 'Website not equal to ']],
  ['Web Leads Not Dialed', ['Lead Source equals Web, Social, Google, Webform, Affiliate, Organic, GOOGLE ADS, Organic M, IB - Google, TB',
    'five9 Disposition equals ', 'Sub Disposition not equal to Fake Lead, Fake Leads', 'Created Date greater than 8/10/2025', open]],
  ['Website Leads', ['Lead Source Category equals Web', 'Lead Source equals Website, Vibe CTV', open]],
  ["Yesterday's Web Leads", [sources, creators, 'Created Date equals YESTERDAY']],
];
const owners = ['Albert Beutel','Alvaro Rosenthal','Arthur Graziano','Chris David','Christian Garcia',
  'Christopher Ayala','Christopher Boulahanis','Craig Caliph','Craig Cohen','David Aflalo','David Medina',
  'Elcain Chase','Eli Khouri','Evgeny Nozdrin','Isaac Levin','Joe Mcdonald','Jose Ledesma','Jovana Pavlovic',
  'Juan Limongi','Kevin Price','Lavell Reed','Leo Gianfortune','Michael Rabin','Moshe Elkayam','Nathan Toney',
  'Ori Keren','Tahja Palmer','Yudirsa Correia','Zachary Michaels','Zachary Redick','Zane Kerns'];
for (const owner of owners) {
  const [first, last] = owner.split(' ');
  const filters = ['Evgeny Nozdrin','Joe Mcdonald','Jovana Pavlovic'].includes(owner)
    ? [`Closer equals ${owner}`, open]
    : owner === 'David Medina' ? [open, 'Owner Last Name equals Medina']
    : [open, `Owner First Name equals ${owner === 'Chris David' ? 'Christopher' : first}`, `Owner Last Name equals ${last}`];
  definitions.push([`${owner} Leads`, filters]);
}
export const LEAD_LIST_VIEWS: LeadListDefinition[] = definitions.map(([label, filters, scope = 'all']) => ({
  label, filters, scope,
  value: label === 'Recently Viewed' ? 'recent' : label === 'All Leads' ? 'all'
    : label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
})).sort((a,b) => a.label.localeCompare(b.label));
