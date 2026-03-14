import { PrismaClient } from "@prisma/client";
import { ensureTemplates } from "../src/seed-templates.js";

const prisma = new PrismaClient();

ensureTemplates(prisma)
  .then(() => {
    console.log("Seeded bot templates");
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
