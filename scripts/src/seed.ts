// Populates the AutFlow Studio database with realistic, internally-consistent
// fictional demo data across all 9 tables. Safe to re-run: it truncates
// existing rows first so the dataset stays deterministic.
import {
  db,
  pool,
  clientsTable,
  projectsTable,
  deliverablesTable,
  paymentsTable,
  documentsTable,
  meetingsTable,
  notesTable,
  tasksTable,
  activityTable,
  usersTable,
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const NOW = new Date("2026-07-11T15:00:00Z");

function daysFrom(base: Date, offset: number): Date {
  return new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
}
function dateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

async function main() {
  console.log("Clearing existing data...");
  await db.execute(sql`
    TRUNCATE TABLE activity, deliverables, documents, meetings, notes, payments, tasks, projects, clients
    RESTART IDENTITY CASCADE
  `);

  console.log("Seeding clients...");
  const clientRows = await db
    .insert(clientsTable)
    .values([
      {
        companyName: "Beacon & Co.",
        industry: "Financial Services",
        website: "https://beaconandco.com",
        email: "hello@beaconandco.com",
        phone: "+1 (415) 555-0142",
        primaryContact: "Nora Whitfield",
        secondaryContact: "Devon Ashby",
        address: "500 Market St, San Francisco, CA",
        timezone: "America/Los_Angeles",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -420)),
        contractValue: "180000",
        monthlyRetainer: "9500",
        paymentMethod: "ACH",
        notes: "Long-term retainer client. Prefers Monday morning check-ins.",
        tags: ["retainer", "vip"],
      },
      {
        companyName: "Solace Wellness",
        industry: "Health & Wellness",
        website: "https://solacewellness.co",
        email: "team@solacewellness.co",
        phone: "+1 (312) 555-0198",
        primaryContact: "Marcus Ibe",
        secondaryContact: null,
        address: "88 LaSalle Ave, Chicago, IL",
        timezone: "America/Chicago",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -260)),
        contractValue: "64000",
        monthlyRetainer: null,
        paymentMethod: "Credit Card",
        notes: "Rebrand + launch project. Founder is very hands-on with design review.",
        tags: ["rebrand"],
      },
      {
        companyName: "Northfield Realty Group",
        industry: "Real Estate",
        website: "https://northfieldrealty.com",
        email: "info@northfieldrealty.com",
        phone: "+1 (617) 555-0110",
        primaryContact: "Elena Vaccaro",
        secondaryContact: "Ben Turcotte",
        address: "12 Beacon Hill Rd, Boston, MA",
        timezone: "America/New_York",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -190)),
        contractValue: "42000",
        monthlyRetainer: "3800",
        paymentMethod: "ACH",
        notes: null,
        tags: ["retainer"],
      },
      {
        companyName: "Kepler Robotics",
        industry: "Manufacturing",
        website: "https://keplerrobotics.io",
        email: "contact@keplerrobotics.io",
        phone: "+1 (512) 555-0177",
        primaryContact: "Priya Raman",
        secondaryContact: "Sam Okafor",
        address: "900 Innovation Way, Austin, TX",
        timezone: "America/Chicago",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -95)),
        contractValue: "96000",
        monthlyRetainer: null,
        paymentMethod: "Wire Transfer",
        notes: "Technical stakeholders, expects detailed weekly status reports.",
        tags: ["enterprise"],
      },
      {
        companyName: "Marrow Coffee Roasters",
        industry: "Food & Beverage",
        website: "https://marrowcoffee.com",
        email: "hi@marrowcoffee.com",
        phone: "+1 (503) 555-0133",
        primaryContact: "Jules Fontaine",
        secondaryContact: null,
        address: "77 Alder St, Portland, OR",
        timezone: "America/Los_Angeles",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -55)),
        contractValue: "18500",
        monthlyRetainer: null,
        paymentMethod: "Credit Card",
        notes: "Small team, fast decision-making, loves bold visuals.",
        tags: ["small-business"],
      },
      {
        companyName: "Ashgrove Legal Partners",
        industry: "Legal",
        website: "https://ashgrovelegal.com",
        email: "office@ashgrovelegal.com",
        phone: "+1 (206) 555-0164",
        primaryContact: "Harold Denby",
        secondaryContact: "Wren Castellano",
        address: "300 Pike St, Seattle, WA",
        timezone: "America/Los_Angeles",
        status: "inactive",
        startDate: dateStr(daysFrom(NOW, -310)),
        contractValue: "52000",
        monthlyRetainer: "4200",
        paymentMethod: "Check",
        notes: "Slow to respond to review requests -- flagged for a check-in call.",
        tags: ["retainer", "at-risk"],
      },
      {
        companyName: "Pinecrest Outdoor Supply",
        industry: "Retail",
        website: "https://pinecrestoutdoor.com",
        email: "support@pinecrestoutdoor.com",
        phone: "+1 (720) 555-0119",
        primaryContact: "Tessa Okonkwo",
        secondaryContact: "Grant Halvorsen",
        address: "455 Larimer St, Denver, CO",
        timezone: "America/Denver",
        status: "active",
        startDate: dateStr(daysFrom(NOW, -640)),
        contractValue: "220000",
        monthlyRetainer: "11000",
        paymentMethod: "ACH",
        notes: "Our longest-running client. Seasonal campaign spikes in spring/fall.",
        tags: ["retainer", "vip", "long-term"],
      },
      {
        companyName: "Verdant Home Goods",
        industry: "E-commerce",
        website: "https://verdanthome.com",
        email: "team@verdanthome.com",
        phone: "+1 (646) 555-0188",
        primaryContact: "Isla Bergman",
        secondaryContact: null,
        address: "210 Bowery, New York, NY",
        timezone: "America/New_York",
        status: "inactive",
        startDate: dateStr(daysFrom(NOW, -520)),
        contractValue: "31000",
        monthlyRetainer: null,
        paymentMethod: "Credit Card",
        notes: "Project wrapped last quarter; open to future work.",
        tags: ["ecommerce"],
      },
    ])
    .returning();

  const clientByName = Object.fromEntries(clientRows.map((c) => [c.companyName, c]));

  console.log("Seeding projects...");
  const projectSpecs = [
    { client: "Beacon & Co.", name: "Q3 Brand Refresh", status: "development", priority: "high", progress: 62, start: -60, deadline: 25, budget: "45000", actual: "27800", revenue: "45000", desc: "Refresh of visual identity ahead of Q3 investor materials." },
    { client: "Beacon & Co.", name: "Investor Portal Redesign", status: "design", priority: "medium", progress: 30, start: -20, deadline: 60, budget: "38000", actual: "9200", revenue: "38000", desc: "Redesign of the client-facing investor reporting portal." },
    { client: "Solace Wellness", name: "Studio Launch Website", status: "review", priority: "urgent", progress: 88, start: -70, deadline: 6, budget: "34000", actual: "29500", revenue: "34000", desc: "Full marketing site + booking flow for new studio launch." },
    { client: "Solace Wellness", name: "App Onboarding Flow", status: "testing", priority: "high", progress: 76, start: -45, deadline: 14, budget: "26000", actual: "18700", revenue: "26000", desc: "Mobile onboarding redesign to reduce signup drop-off." },
    { client: "Northfield Realty Group", name: "Listing Site Overhaul", status: "delivered", priority: "medium", progress: 100, start: -150, deadline: -30, budget: "40000", actual: "38200", revenue: "40000", desc: "New listings platform with map-based search." },
    { client: "Northfield Realty Group", name: "Agent CRM Integration", status: "waiting", priority: "low", progress: 12, start: -10, deadline: 90, budget: "15000", actual: "1800", revenue: null, desc: "Integrate agent CRM with the new listings platform." },
    { client: "Kepler Robotics", name: "Technical Documentation Hub", status: "development", priority: "high", progress: 54, start: -50, deadline: 20, budget: "52000", actual: "24300", revenue: "52000", desc: "Centralized docs hub for hardware + firmware teams." },
    { client: "Kepler Robotics", name: "Investor Deck Design System", status: "planning", priority: "medium", progress: 5, start: -5, deadline: 45, budget: "18000", actual: "600", revenue: null, desc: "Reusable slide system for fundraising decks." },
    { client: "Marrow Coffee Roasters", name: "Packaging & Label Redesign", status: "review", priority: "medium", progress: 82, start: -35, deadline: 4, budget: "12000", actual: "9700", revenue: "12000", desc: "New label system across the core roast lineup." },
    { client: "Ashgrove Legal Partners", name: "Firm Website Relaunch", status: "paused", priority: "medium", progress: 40, start: -80, deadline: -5, budget: "28000", actual: "13400", revenue: "28000", desc: "Relaunch paused pending client-side content approval." },
    { client: "Pinecrest Outdoor Supply", name: "Fall Campaign Microsite", status: "development", priority: "urgent", progress: 68, start: -25, deadline: 10, budget: "22000", actual: "14100", revenue: "22000", desc: "Seasonal campaign microsite with gear guide content." },
    { client: "Pinecrest Outdoor Supply", name: "Loyalty Program Design", status: "design", priority: "medium", progress: 35, start: -15, deadline: 40, budget: "19500", actual: "5200", revenue: "19500", desc: "Points-based loyalty program UX and visual system." },
    { client: "Pinecrest Outdoor Supply", name: "Storefront Signage Refresh", status: "cancelled", priority: "low", progress: 8, start: -100, deadline: -60, budget: "9000", actual: "1100", revenue: null, desc: "Cancelled after client shifted budget to digital." },
    { client: "Verdant Home Goods", name: "Holiday Catalog Site", status: "delivered", priority: "medium", progress: 100, start: -200, deadline: -140, budget: "31000", actual: "29800", revenue: "31000", desc: "Seasonal catalog microsite, wrapped after launch." },
  ] as const;

  const projectRows = await db
    .insert(projectsTable)
    .values(
      projectSpecs.map((p) => ({
        clientId: clientByName[p.client]!.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        startDate: dateStr(daysFrom(NOW, p.start)),
        deadline: dateStr(daysFrom(NOW, p.deadline)),
        estimatedBudget: p.budget,
        actualCost: p.actual,
        revenue: p.revenue,
        description: p.desc,
        ownerNotes: null,
      })),
    )
    .returning();

  const projectByName = Object.fromEntries(projectRows.map((p) => [p.name, p]));

  console.log("Seeding deliverables...");
  const deliverableSpecs: { project: string; title: string; status: string; deadlineOffset: number; assignedTo: string; completedOffset?: number }[] = [
    { project: "Q3 Brand Refresh", title: "Logo system exploration", status: "done", deadlineOffset: -30, assignedTo: "Maya Chen", completedOffset: -28 },
    { project: "Q3 Brand Refresh", title: "Color & typography guidelines", status: "done", deadlineOffset: -15, assignedTo: "Maya Chen", completedOffset: -14 },
    { project: "Q3 Brand Refresh", title: "Investor deck template", status: "in_progress", deadlineOffset: 10, assignedTo: "Theo Brandt" },
    { project: "Q3 Brand Refresh", title: "Brand guidelines PDF", status: "pending", deadlineOffset: 22, assignedTo: "Maya Chen" },
    { project: "Investor Portal Redesign", title: "Wireframes v1", status: "done", deadlineOffset: -5, assignedTo: "Theo Brandt", completedOffset: -4 },
    { project: "Investor Portal Redesign", title: "High-fidelity mockups", status: "in_progress", deadlineOffset: 15, assignedTo: "Theo Brandt" },
    { project: "Studio Launch Website", title: "Homepage design", status: "done", deadlineOffset: -40, assignedTo: "Priya Nadar", completedOffset: -38 },
    { project: "Studio Launch Website", title: "Booking flow build", status: "done", deadlineOffset: -12, assignedTo: "Sam Okoye", completedOffset: -10 },
    { project: "Studio Launch Website", title: "QA + accessibility pass", status: "review", deadlineOffset: 3, assignedTo: "Priya Nadar" },
    { project: "App Onboarding Flow", title: "Onboarding flow prototype", status: "done", deadlineOffset: -20, assignedTo: "Sam Okoye", completedOffset: -19 },
    { project: "App Onboarding Flow", title: "Usability testing round", status: "review", deadlineOffset: 2, assignedTo: "Priya Nadar" },
    { project: "Listing Site Overhaul", title: "Map search implementation", status: "done", deadlineOffset: -60, assignedTo: "Theo Brandt", completedOffset: -58 },
    { project: "Listing Site Overhaul", title: "Launch handoff docs", status: "done", deadlineOffset: -31, assignedTo: "Theo Brandt", completedOffset: -30 },
    { project: "Technical Documentation Hub", title: "Content architecture", status: "done", deadlineOffset: -25, assignedTo: "Maya Chen", completedOffset: -22 },
    { project: "Technical Documentation Hub", title: "Component library for docs", status: "in_progress", deadlineOffset: 12, assignedTo: "Sam Okoye" },
    { project: "Packaging & Label Redesign", title: "Label artwork final files", status: "review", deadlineOffset: 1, assignedTo: "Priya Nadar" },
    { project: "Fall Campaign Microsite", title: "Gear guide content build", status: "in_progress", deadlineOffset: 6, assignedTo: "Theo Brandt" },
    { project: "Loyalty Program Design", title: "Points UI concepts", status: "in_progress", deadlineOffset: 18, assignedTo: "Maya Chen" },
  ];

  await db.insert(deliverablesTable).values(
    deliverableSpecs.map((d) => ({
      projectId: projectByName[d.project]!.id,
      title: d.title,
      status: d.status,
      deadline: dateStr(daysFrom(NOW, d.deadlineOffset)),
      assignedTo: d.assignedTo,
      completionDate: d.completedOffset != null ? dateStr(daysFrom(NOW, d.completedOffset)) : null,
      notes: null,
    })),
  );

  console.log("Seeding payments...");
  const paymentSpecs: { client: string; project?: string; invoice: string; amount: string; status: string; dueOffset: number; paidOffset?: number; method?: string }[] = [
    { client: "Beacon & Co.", project: "Q3 Brand Refresh", invoice: "INV-1041", amount: "15000", status: "paid", dueOffset: -45, paidOffset: -47, method: "ACH" },
    { client: "Beacon & Co.", project: "Q3 Brand Refresh", invoice: "INV-1058", amount: "15000", status: "paid", dueOffset: -15, paidOffset: -16, method: "ACH" },
    { client: "Beacon & Co.", project: "Q3 Brand Refresh", invoice: "INV-1072", amount: "15000", status: "pending", dueOffset: 15 },
    { client: "Beacon & Co.", invoice: "INV-1080", amount: "9500", status: "pending", dueOffset: 5, method: "ACH" },
    { client: "Solace Wellness", project: "Studio Launch Website", invoice: "INV-2011", amount: "17000", status: "paid", dueOffset: -50, paidOffset: -52, method: "Credit Card" },
    { client: "Solace Wellness", project: "Studio Launch Website", invoice: "INV-2029", amount: "17000", status: "overdue", dueOffset: -8 },
    { client: "Solace Wellness", project: "App Onboarding Flow", invoice: "INV-2034", amount: "13000", status: "paid", dueOffset: -20, paidOffset: -21, method: "Credit Card" },
    { client: "Northfield Realty Group", project: "Listing Site Overhaul", invoice: "INV-3005", amount: "20000", status: "paid", dueOffset: -120, paidOffset: -122, method: "ACH" },
    { client: "Northfield Realty Group", project: "Listing Site Overhaul", invoice: "INV-3019", amount: "20000", status: "paid", dueOffset: -35, paidOffset: -36, method: "ACH" },
    { client: "Northfield Realty Group", invoice: "INV-3041", amount: "3800", status: "pending", dueOffset: 8, method: "ACH" },
    { client: "Kepler Robotics", project: "Technical Documentation Hub", invoice: "INV-4002", amount: "26000", status: "paid", dueOffset: -40, paidOffset: -41, method: "Wire Transfer" },
    { client: "Kepler Robotics", project: "Technical Documentation Hub", invoice: "INV-4018", amount: "26000", status: "pending", dueOffset: 12 },
    { client: "Kepler Robotics", project: "Investor Deck Design System", invoice: "INV-4025", amount: "9000", status: "pending", dueOffset: 25 },
    { client: "Marrow Coffee Roasters", project: "Packaging & Label Redesign", invoice: "INV-5003", amount: "6000", status: "paid", dueOffset: -25, paidOffset: -27, method: "Credit Card" },
    { client: "Marrow Coffee Roasters", project: "Packaging & Label Redesign", invoice: "INV-5011", amount: "6000", status: "pending", dueOffset: 3 },
    { client: "Ashgrove Legal Partners", project: "Firm Website Relaunch", invoice: "INV-6008", amount: "14000", status: "paid", dueOffset: -60, paidOffset: -63, method: "Check" },
    { client: "Ashgrove Legal Partners", project: "Firm Website Relaunch", invoice: "INV-6021", amount: "14000", status: "overdue", dueOffset: -22 },
    { client: "Ashgrove Legal Partners", invoice: "INV-6030", amount: "4200", status: "overdue", dueOffset: -5 },
    { client: "Pinecrest Outdoor Supply", project: "Fall Campaign Microsite", invoice: "INV-7060", amount: "11000", status: "paid", dueOffset: -18, paidOffset: -19, method: "ACH" },
    { client: "Pinecrest Outdoor Supply", project: "Fall Campaign Microsite", invoice: "INV-7071", amount: "11000", status: "pending", dueOffset: 9 },
    { client: "Pinecrest Outdoor Supply", project: "Loyalty Program Design", invoice: "INV-7082", amount: "9750", status: "pending", dueOffset: 20 },
    { client: "Pinecrest Outdoor Supply", invoice: "INV-7090", amount: "11000", status: "paid", dueOffset: -3, paidOffset: -4, method: "ACH" },
    { client: "Verdant Home Goods", project: "Holiday Catalog Site", invoice: "INV-8014", amount: "31000", status: "paid", dueOffset: -150, paidOffset: -155, method: "Credit Card" },
    { client: "Verdant Home Goods", invoice: "INV-8020", amount: "2500", status: "cancelled", dueOffset: -100 },
  ];

  await db.insert(paymentsTable).values(
    paymentSpecs.map((p) => ({
      clientId: clientByName[p.client]!.id,
      projectId: p.project ? projectByName[p.project]!.id : null,
      invoiceNumber: p.invoice,
      amount: p.amount,
      status: p.status,
      dueDate: dateStr(daysFrom(NOW, p.dueOffset)),
      paidDate: p.paidOffset != null ? dateStr(daysFrom(NOW, p.paidOffset)) : null,
      paymentMethod: p.method ?? null,
      remainingBalance: p.status === "paid" || p.status === "cancelled" ? "0" : p.amount,
      notes: null,
    })),
  );

  console.log("Seeding documents...");
  const documentSpecs: { client: string; project?: string; title: string; type: string; url?: string; notes?: string; ageOffset: number }[] = [
    { client: "Beacon & Co.", project: "Q3 Brand Refresh", title: "Master Services Agreement", type: "contract", url: "https://drive.example.com/beacon/msa.pdf", ageOffset: -420 },
    { client: "Beacon & Co.", project: "Q3 Brand Refresh", title: "Brand Refresh Figma File", type: "figma", url: "https://figma.com/file/beacon-brand-refresh", ageOffset: -55 },
    { client: "Beacon & Co.", title: "Q2 Retainer Invoice Packet", type: "invoice", url: "https://drive.example.com/beacon/q2-invoices.pdf", ageOffset: -90 },
    { client: "Solace Wellness", project: "Studio Launch Website", title: "Studio Launch Proposal", type: "proposal", url: "https://drive.example.com/solace/proposal.pdf", ageOffset: -75 },
    { client: "Solace Wellness", project: "Studio Launch Website", title: "Site Content Google Doc", type: "google_drive", url: "https://docs.google.com/document/d/solace-content", ageOffset: -60 },
    { client: "Solace Wellness", title: "Brand Assets Folder", type: "brand_assets", url: "https://drive.example.com/solace/brand-assets", ageOffset: -260 },
    { client: "Northfield Realty Group", project: "Listing Site Overhaul", title: "Listings Platform Repo", type: "github", url: "https://github.com/autflow/northfield-listings", ageOffset: -140 },
    { client: "Northfield Realty Group", title: "Signed Retainer Agreement", type: "contract", url: "https://drive.example.com/northfield/retainer.pdf", ageOffset: -190 },
    { client: "Kepler Robotics", project: "Technical Documentation Hub", title: "Docs Hub Architecture Notes", type: "design", url: "https://drive.example.com/kepler/architecture.pdf", ageOffset: -45 },
    { client: "Kepler Robotics", title: "Kepler MSA", type: "contract", url: "https://drive.example.com/kepler/msa.pdf", ageOffset: -95 },
    { client: "Marrow Coffee Roasters", project: "Packaging & Label Redesign", title: "Label Die-Line Files", type: "design", url: "https://drive.example.com/marrow/dielines.zip", ageOffset: -20 },
    { client: "Ashgrove Legal Partners", project: "Firm Website Relaunch", title: "Content Approval Doc", type: "google_drive", url: "https://docs.google.com/document/d/ashgrove-content", ageOffset: -70, notes: "Awaiting sign-off from partners." },
    { client: "Pinecrest Outdoor Supply", project: "Fall Campaign Microsite", title: "Campaign Creative Brief", type: "proposal", url: "https://drive.example.com/pinecrest/brief.pdf", ageOffset: -25 },
    { client: "Pinecrest Outdoor Supply", title: "Master Retainer Agreement", type: "contract", url: "https://drive.example.com/pinecrest/retainer.pdf", ageOffset: -640 },
    { client: "Verdant Home Goods", project: "Holiday Catalog Site", title: "Catalog Site Handoff Link", type: "link", url: "https://verdanthome.com/holiday", ageOffset: -140 },
  ];

  await db.insert(documentsTable).values(
    documentSpecs.map((d) => ({
      clientId: clientByName[d.client]!.id,
      projectId: d.project ? projectByName[d.project]!.id : null,
      title: d.title,
      type: d.type,
      url: d.url ?? null,
      notes: d.notes ?? null,
    })),
  );

  console.log("Seeding meetings...");
  const meetingSpecs: { client: string; dateOffset: number; summary: string; actionItems?: string; nextOffset?: number }[] = [
    { client: "Beacon & Co.", dateOffset: -14, summary: "Reviewed logo direction 2 and 4 with Nora; leaning toward direction 4.", actionItems: "Refine direction 4 palette; share updated deck by Friday.", nextOffset: 3 },
    { client: "Beacon & Co.", dateOffset: 3, summary: "Upcoming: present finalized brand guidelines.", nextOffset: 17 },
    { client: "Solace Wellness", dateOffset: -7, summary: "Walked through booking flow prototype; Marcus requested simpler intake form.", actionItems: "Cut intake form from 6 fields to 3.", nextOffset: 5 },
    { client: "Solace Wellness", dateOffset: 5, summary: "Upcoming: QA sign-off call before launch." },
    { client: "Northfield Realty Group", dateOffset: -3, summary: "Kickoff for CRM integration scope; confirmed API access timeline.", actionItems: "Northfield to share CRM sandbox credentials.", nextOffset: 11 },
    { client: "Kepler Robotics", dateOffset: -10, summary: "Weekly technical sync -- reviewed docs hub IA with engineering leads.", actionItems: "Engineering to finalize taxonomy for firmware docs.", nextOffset: 4 },
    { client: "Kepler Robotics", dateOffset: 4, summary: "Upcoming: weekly technical sync." },
    { client: "Marrow Coffee Roasters", dateOffset: -6, summary: "Reviewed final label artwork; one round of print-proof feedback pending.", nextOffset: 2 },
    { client: "Ashgrove Legal Partners", dateOffset: -35, summary: "Content review call -- partners were unresponsive on requested edits.", actionItems: "Follow up with Harold directly; consider pausing sprint if no response." },
    { client: "Pinecrest Outdoor Supply", dateOffset: -4, summary: "Fall campaign creative review; approved hero concept and copy direction.", actionItems: "Finalize gear guide photography selects.", nextOffset: 6 },
    { client: "Pinecrest Outdoor Supply", dateOffset: 6, summary: "Upcoming: campaign pre-launch review." },
  ];

  await db.insert(meetingsTable).values(
    meetingSpecs.map((m) => ({
      clientId: clientByName[m.client]!.id,
      date: daysFrom(NOW, m.dateOffset),
      summary: m.summary,
      actionItems: m.actionItems ?? null,
      nextMeeting: m.nextOffset != null ? daysFrom(NOW, m.nextOffset) : null,
      attachments: null,
    })),
  );

  console.log("Seeding notes...");
  const noteSpecs: { client?: string; project?: string; content: string; ageOffset: number }[] = [
    { client: "Beacon & Co.", content: "Nora mentioned their board meeting is Aug 3rd -- brand guidelines need to be final by end of July.", ageOffset: -12 },
    { client: "Solace Wellness", project: "Studio Launch Website", content: "Marcus is very responsive but wants final say on all copy -- route drafts to him directly, not the marketing coordinator.", ageOffset: -18 },
    { client: "Northfield Realty Group", content: "Elena prefers async updates over Loom video rather than calls when possible.", ageOffset: -25 },
    { client: "Kepler Robotics", project: "Technical Documentation Hub", content: "Engineering team uses Notion internally -- consider exporting the docs hub content model to match their taxonomy.", ageOffset: -9 },
    { client: "Ashgrove Legal Partners", content: "Third week of no response on content review. Escalate to a direct call before extending the pause further.", ageOffset: -4 },
    { client: "Pinecrest Outdoor Supply", content: "Tessa flagged that last fall's campaign microsite had strong mobile conversion -- keep the mobile-first approach for this year.", ageOffset: -20 },
    { client: "Marrow Coffee Roasters", content: "Jules wants to explore a limited-edition holiday label variant once the core redesign ships.", ageOffset: -5 },
  ];

  await db.insert(notesTable).values(
    noteSpecs.map((n) => ({
      clientId: n.client ? clientByName[n.client]!.id : null,
      projectId: n.project ? projectByName[n.project]!.id : null,
      content: n.content,
      createdAt: daysFrom(NOW, n.ageOffset),
    })),
  );

  console.log("Seeding tasks...");
  const taskSpecs: { title: string; priority: string; status: string; deadlineOffset?: number; client?: string; project?: string; notes?: string }[] = [
    { title: "Finalize direction 4 color palette", priority: "high", status: "in_progress", deadlineOffset: 2, client: "Beacon & Co.", project: "Q3 Brand Refresh" },
    { title: "Export brand guidelines PDF for review", priority: "medium", status: "todo", deadlineOffset: 20, client: "Beacon & Co.", project: "Q3 Brand Refresh" },
    { title: "Simplify Solace intake form to 3 fields", priority: "urgent", status: "in_progress", deadlineOffset: 1, client: "Solace Wellness", project: "App Onboarding Flow" },
    { title: "Prep QA checklist for studio launch site", priority: "high", status: "todo", deadlineOffset: 3, client: "Solace Wellness", project: "Studio Launch Website" },
    { title: "Request CRM sandbox credentials from Northfield", priority: "medium", status: "todo", deadlineOffset: 4, client: "Northfield Realty Group", project: "Agent CRM Integration" },
    { title: "Draft docs hub taxonomy proposal", priority: "high", status: "in_progress", deadlineOffset: 5, client: "Kepler Robotics", project: "Technical Documentation Hub" },
    { title: "Review firmware team feedback on IA", priority: "medium", status: "todo", deadlineOffset: 8, client: "Kepler Robotics", project: "Technical Documentation Hub" },
    { title: "Send print-proof feedback for coffee labels", priority: "high", status: "in_progress", deadlineOffset: 1, client: "Marrow Coffee Roasters", project: "Packaging & Label Redesign" },
    { title: "Call Harold re: stalled content review", priority: "urgent", status: "todo", deadlineOffset: 0, client: "Ashgrove Legal Partners", project: "Firm Website Relaunch" },
    { title: "Finalize gear guide photography selects", priority: "high", status: "in_progress", deadlineOffset: 2, client: "Pinecrest Outdoor Supply", project: "Fall Campaign Microsite" },
    { title: "Sketch loyalty tier iconography", priority: "medium", status: "todo", deadlineOffset: 12, client: "Pinecrest Outdoor Supply", project: "Loyalty Program Design" },
    { title: "Prepare Q3 retainer invoice batch", priority: "medium", status: "todo", deadlineOffset: 5 },
    { title: "Update agency capacity planning sheet", priority: "low", status: "todo", deadlineOffset: 7 },
    { title: "Archive Verdant Home Goods project assets", priority: "low", status: "done", notes: "Wrapped after final delivery." },
    { title: "Review Kepler investor deck template concepts", priority: "medium", status: "todo", deadlineOffset: 15, client: "Kepler Robotics", project: "Investor Deck Design System" },
  ];

  await db.insert(tasksTable).values(
    taskSpecs.map((t) => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      deadline: t.deadlineOffset != null ? dateStr(daysFrom(NOW, t.deadlineOffset)) : null,
      notes: t.notes ?? null,
      clientId: t.client ? clientByName[t.client]!.id : null,
      projectId: t.project ? projectByName[t.project]!.id : null,
    })),
  );

  console.log("Seeding activity feed...");
  const activitySpecs: { type: string; entityType: string; description: string; client?: string; ageOffset: number }[] = [
    { type: "client_created", entityType: "client", description: 'Client "Beacon & Co." created', client: "Beacon & Co.", ageOffset: -420 },
    { type: "project_created", entityType: "project", description: 'Project "Q3 Brand Refresh" created', client: "Beacon & Co.", ageOffset: -60 },
    { type: "payment_received", entityType: "payment", description: "Payment of $15,000 received (INV-1058)", client: "Beacon & Co.", ageOffset: -16 },
    { type: "document_added", entityType: "document", description: 'Document "Brand Refresh Figma File" added', client: "Beacon & Co.", ageOffset: -55 },
    { type: "meeting_logged", entityType: "meeting", description: "Logged meeting: reviewed logo directions", client: "Beacon & Co.", ageOffset: -14 },
    { type: "project_updated", entityType: "project", description: 'Project "Studio Launch Website" moved to review', client: "Solace Wellness", ageOffset: -6 },
    { type: "payment_overdue", entityType: "payment", description: "Invoice INV-2029 is now overdue", client: "Solace Wellness", ageOffset: -8 },
    { type: "project_delivered", entityType: "project", description: 'Project "Listing Site Overhaul" marked delivered', client: "Northfield Realty Group", ageOffset: -30 },
    { type: "project_created", entityType: "project", description: 'Project "Agent CRM Integration" created', client: "Northfield Realty Group", ageOffset: -10 },
    { type: "document_added", entityType: "document", description: 'Document "Docs Hub Architecture Notes" added', client: "Kepler Robotics", ageOffset: -45 },
    { type: "meeting_logged", entityType: "meeting", description: "Logged meeting: weekly technical sync", client: "Kepler Robotics", ageOffset: -10 },
    { type: "project_updated", entityType: "project", description: 'Project "Packaging & Label Redesign" moved to review', client: "Marrow Coffee Roasters", ageOffset: -3 },
    { type: "project_paused", entityType: "project", description: 'Project "Firm Website Relaunch" paused pending client feedback', client: "Ashgrove Legal Partners", ageOffset: -35 },
    { type: "payment_overdue", entityType: "payment", description: "Invoice INV-6030 is now overdue", client: "Ashgrove Legal Partners", ageOffset: -5 },
    { type: "project_updated", entityType: "project", description: 'Project "Fall Campaign Microsite" progress updated to 68%', client: "Pinecrest Outdoor Supply", ageOffset: -2 },
    { type: "payment_received", entityType: "payment", description: "Payment of $11,000 received (INV-7090)", client: "Pinecrest Outdoor Supply", ageOffset: -4 },
    { type: "project_delivered", entityType: "project", description: 'Project "Holiday Catalog Site" marked delivered', client: "Verdant Home Goods", ageOffset: -140 },
  ];

  await db.insert(activityTable).values(
    activitySpecs.map((a) => ({
      type: a.type,
      entityType: a.entityType,
      entityId: null,
      description: a.description,
      clientId: a.client ? clientByName[a.client]!.id : null,
      createdAt: daysFrom(NOW, a.ageOffset),
    })),
  );

  console.log("Seed complete.");

  // Ensure the default admin user exists (idempotent — does not truncate users table)
  console.log("Ensuring default admin user...");
  const [existingAdmin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "admin@autflow.io"))
    .limit(1);

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync("admin123", 12);
    await db.insert(usersTable).values({
      name: "Agency Owner",
      email: "admin@autflow.io",
      passwordHash,
      role: "owner",
    });
    console.log("Created admin user: admin@autflow.io / admin123");
  } else {
    console.log("Admin user already exists — skipping.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
