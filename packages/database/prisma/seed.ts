import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@urbanlinknetworks.com";
  const adminPassword = "Admin@123";
  const fielderEmail = "mike@example.com";
  const fielderPassword = "Fielder@123";

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const fielderPasswordHash = await bcrypt.hash(fielderPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.admin,
      firstName: "Admin",
      lastName: "User",
    },
    update: {},
  });

  let amdocs = await prisma.client.findFirst({ where: { name: "Amdocs" } });
  if (!amdocs) {
    amdocs = await prisma.client.create({
      data: {
        name: "Amdocs",
        contactName: "Operations",
        defaultSqftRate: 0.03,
        billingTerms: "Net 30",
      },
    });
  }

  const sampleExists = await prisma.client.findFirst({ where: { name: "Sample Client" } });
  if (!sampleExists) {
    await prisma.client.create({ data: { name: "Sample Client", defaultSqftRate: 0.03 } });
  }

  let premiumClient = await prisma.client.findFirst({ where: { name: "Premium Telecom Co" } });
  if (!premiumClient) {
    premiumClient = await prisma.client.create({
      data: {
        name: "Premium Telecom Co",
        defaultSqftRate: 0.035,
        billingTerms: "Net 15",
        notes: "Higher rate client — overrides state and company defaults",
      },
    });
  }

  const stateRates = [
    { state: "CO", clientSqftRate: 0.03, fielderSqftRate: 0.015, notes: "Colorado standard" },
    { state: "MT", clientSqftRate: 0.03, fielderSqftRate: 0.015, notes: "Montana standard" },
    { state: "UT", clientSqftRate: 0.032, fielderSqftRate: 0.016, notes: "Utah — higher cost market" },
    { state: "ND", clientSqftRate: 0.03, fielderSqftRate: 0.015, notes: "North Dakota standard" },
    { state: "NE", clientSqftRate: 0.03, fielderSqftRate: 0.015, notes: "Nebraska standard" },
  ];

  for (const sr of stateRates) {
    await prisma.stateRate.upsert({
      where: { state: sr.state },
      create: sr,
      update: { clientSqftRate: sr.clientSqftRate, fielderSqftRate: sr.fielderSqftRate, notes: sr.notes },
    });
  }

  let fielder = await prisma.fielder.findFirst({ where: { email: fielderEmail } });
  if (!fielder) {
    fielder = await prisma.fielder.create({
      data: {
        firstName: "Mike",
        lastName: "Johnson",
        phone: "555-0100",
        email: fielderEmail,
        employmentType: "contractor_1099",
        defaultSqftRate: 0.015,
        region: "Mountain West",
        skills: ["fiber", "splicing"],
      },
    });
  }

  await prisma.user.upsert({
    where: { email: fielderEmail },
    create: {
      email: fielderEmail,
      passwordHash: fielderPasswordHash,
      role: UserRole.fielder,
      fielderId: fielder.id,
    },
    update: { fielderId: fielder.id },
  });

  const projects = [
    {
      projectNumber: "PRJ 3455",
      clientId: amdocs.id,
      title: "Fiber deployment — Denver metro",
      siteAddress: "100 Main St",
      city: "Denver",
      state: "CO",
      zip: "80202",
      jobType: "Fiber",
      sqft: 10000,
      clientSqftRate: 0.03,
      status: "assigned" as const,
      assignment: { fielderSqftRate: 0.015, assignedSqft: 10000, status: "assigned" as const },
    },
    {
      projectNumber: "PRJ 3456",
      clientId: amdocs.id,
      title: "Fiber deployment — Billings",
      siteAddress: "500 Grand Ave",
      city: "Billings",
      state: "MT",
      zip: "59101",
      jobType: "Fiber",
      sqft: 30000,
      clientSqftRate: 0.03,
      status: "draft" as const,
    },
    {
      projectNumber: "PRJ 3457",
      clientId: premiumClient.id,
      title: "MDU build — Salt Lake City",
      siteAddress: "200 State St",
      city: "Salt Lake City",
      state: "UT",
      zip: "84101",
      jobType: "MDU",
      sqft: 15000,
      clientSqftRate: 0.035,
      status: "in_progress" as const,
      assignment: { fielderSqftRate: 0.015, assignedSqft: 15000, status: "in_progress" as const },
    },
    {
      projectNumber: "PRJ 3458",
      clientId: amdocs.id,
      title: "Fiber — Fargo",
      siteAddress: "1 Broadway",
      city: "Fargo",
      state: "ND",
      zip: "58102",
      jobType: "Fiber",
      sqft: 8000,
      clientSqftRate: 0.03,
      status: "complete" as const,
      completedAt: new Date(),
    },
  ];

  for (const p of projects) {
    const { assignment, completedAt, ...projectData } = p;
    const existing = await prisma.project.findUnique({ where: { projectNumber: p.projectNumber } });
    if (existing) continue;

    await prisma.project.create({
      data: {
        ...projectData,
        completedAt,
        assignments: assignment
          ? {
              create: {
                fielderId: fielder.id,
                ...assignment,
              },
            }
          : undefined,
      },
    });
  }

  const financeSettings = [
    { key: "mileage_rate", value: "0.67" },
    { key: "default_currency", value: "USD" },
    { key: "fiscal_year_start", value: "01-01" },
    { key: "receipt_required_above", value: "25" },
    { key: "company_name", value: "Urbanlink Networks LLC" },
  ];
  for (const s of financeSettings) {
    await prisma.financialSetting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }

  const categories = [
    { name: "Travel", subs: ["Fuel", "Lodging", "Meals", "Airfare", "Rental Car"] },
    { name: "Equipment", subs: ["Tools", "Safety Gear", "Electronics"] },
    { name: "Office", subs: ["Supplies", "Software", "Phone"] },
    { name: "Vehicle", subs: ["Maintenance", "Insurance", "Registration"] },
    { name: "Professional Services", subs: ["Legal", "Accounting", "Consulting"] },
    { name: "Insurance", subs: ["General Liability", "Workers Comp"] },
    { name: "Utilities", subs: ["Internet", "Phone", "Electric"] },
    { name: "Payroll & Contractors", subs: ["1099 Payments", "W2 Payroll"] },
    { name: "Other", subs: ["Miscellaneous"] },
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = await prisma.expenseCategory.upsert({
      where: { name: categories[i].name },
      create: { name: categories[i].name, sortOrder: i },
      update: { sortOrder: i },
    });
    for (let j = 0; j < categories[i].subs.length; j++) {
      await prisma.expenseSubcategory.upsert({
        where: { categoryId_name: { categoryId: cat.id, name: categories[i].subs[j] } },
        create: { categoryId: cat.id, name: categories[i].subs[j], sortOrder: j },
        update: { sortOrder: j },
      });
    }
  }

  const travelCat = await prisma.expenseCategory.findFirst({ where: { name: "Travel" } });

  let bank = await prisma.paymentMethod.findFirst({ where: { name: "Business Checking" } });
  if (!bank) {
    bank = await prisma.paymentMethod.create({
      data: {
        name: "Business Checking",
        type: "bank",
        accountNickname: "Primary Operating",
        lastFour: "4521",
        openingBalance: 25000,
        currentBalance: 25000,
      },
    });
  }

  const ccExists = await prisma.paymentMethod.findFirst({ where: { name: "Company Credit Card" } });
  if (!ccExists) {
    await prisma.paymentMethod.create({
      data: {
        name: "Company Credit Card",
        type: "credit_card",
        lastFour: "8899",
        openingBalance: 0,
        currentBalance: -1250,
      },
    });
  }

  const shellExists = await prisma.vendor.findFirst({ where: { name: "Shell Gas Station" } });
  if (!shellExists) {
    await prisma.vendor.create({
      data: {
        name: "Shell Gas Station",
        vendorType: "supplier",
        defaultCategoryId: travelCat?.id,
        defaultPaymentMethodId: bank.id,
      },
    });
  }

  const hdExists = await prisma.vendor.findFirst({ where: { name: "Home Depot" } });
  if (!hdExists) {
    await prisma.vendor.create({
      data: { name: "Home Depot", vendorType: "supplier" },
    });
  }

  const truckExists = await prisma.vehicle.findFirst({ where: { name: "Company Truck 1" } });
  if (!truckExists) {
    await prisma.vehicle.create({
      data: { name: "Company Truck 1", make: "Ford", model: "F-150", year: 2022 },
    });
  }

  console.log("Seed complete (idempotent — safe to re-run).");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Fielder login: ${fielderEmail} / ${fielderPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
