// Seed script: creates default admin user and the 6 stations matching existing Excel files
// Run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPassword,
      displayName: "مدیر سامانه",
      role: "ADMIN",
    },
  });
  console.log(`  Admin user: ${admin.username} (id: ${admin.id})`);
  console.log(`    password: admin123  ← CHANGE THIS AFTER FIRST LOGIN`);

  // Create the 6 stations matching the existing Excel files
  const stations = [
    { name: "سه راهی",          code: "Link" },
    { name: "ایستگاه شهدا",      code: "N3" },
    { name: "ایستگاه شارستان",   code: "O3" },
    { name: "ایستگاه باب الجواد", code: "P3" },
    { name: "ایستگاه دانش",      code: "Q3" },
    { name: "ایستگاه بسیج",      code: "R3" },
  ];

  for (const s of stations) {
    const station = await db.station.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    console.log(`  Station: ${station.code} (${station.name})`);
  }

  console.log("\nSeed complete.");
  console.log("Login at /login with admin / admin123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
