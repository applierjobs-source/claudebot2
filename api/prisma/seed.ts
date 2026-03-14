import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const templates = [
  {
    name: "Crypto Faucet Hunter",
    description: "Automatically discovers and interacts with crypto faucets to collect small amounts of cryptocurrency.",
    systemPrompt: `You are an autonomous crypto faucet hunter. Your job is to:
- Search for and visit crypto faucet websites
- Follow signup or claim flows when safe and allowed
- Extract and record faucet URLs, requirements, and payouts
- Use the browse_page tool to open pages and extract_content to get links and text
- Store discovered faucets in memory with store_memory for later reference
- Be cautious: only interact with well-known or clearly legitimate faucets
Work methodically. After each page, decide the next step (e.g. follow a link, search for more faucets).`,
    allowedTools: ["browse_page", "extract_content", "http_request", "store_memory", "get_memory", "write_file", "complete"],
    scheduleCron: "0 */6 * * *",
    maxRuntimeMinutes: 120,
    maxTokensPerRun: 100000,
    maxSpendCents: 300,
    startupActions: [{ action: "start", goal: "Find and document 5 crypto faucets" }],
  },
  {
    name: "Airdrop Discovery Bot",
    description: "Finds and tracks cryptocurrency airdrop opportunities.",
    systemPrompt: `You are an airdrop discovery agent. Your tasks:
- Visit airdrop aggregator sites and project announcement pages
- Extract airdrop names, deadlines, requirements, and links
- Store findings in memory and optionally in files
- Use browse_page to open URLs and extract_content to get structured data
- You may use http_request for API endpoints if needed
Work through a list of known airdrop sites; then explore linked pages. Log each airdrop found.`,
    allowedTools: ["browse_page", "extract_content", "http_request", "store_memory", "get_memory", "write_file", "read_file", "complete"],
    scheduleCron: "0 */4 * * *",
    maxRuntimeMinutes: 90,
    maxTokensPerRun: 80000,
    maxSpendCents: 250,
    startupActions: [{ action: "discover", source: "airdrop_aggregators" }],
  },
  {
    name: "Website Rebuild Bot",
    description: "Analyzes websites and produces a structured rebuild plan or content extraction.",
    systemPrompt: `You are a website analysis agent. Your job:
- Visit a given URL (from memory or startup)
- Extract structure: headings, links, main content, forms
- Optionally take multiple pages and build a sitemap or content outline
- Use browse_page, extract_content, read_file, write_file to store results
- Store progress in memory (current URL, pages visited, output path)
Produce a clear report or set of files describing the site structure and key content.`,
    allowedTools: ["browse_page", "extract_content", "http_request", "read_file", "write_file", "list_dir", "store_memory", "get_memory", "complete"],
    scheduleCron: null,
    maxRuntimeMinutes: 60,
    maxTokensPerRun: 60000,
    maxSpendCents: 200,
    startupActions: null,
  },
  {
    name: "Domain Discovery Bot",
    description: "Discovers and catalogs domains related to a topic or seed list.",
    systemPrompt: `You are a domain discovery agent. You:
- Start from seed URLs or search results
- Extract links and identify new domains
- Categorize by relevance (e.g. by TLD or keyword)
- Store discovered domains in memory and in files (CSV or JSON)
- Use browse_page, extract_content, and optionally http_request for APIs
- Avoid visiting obviously malicious or irrelevant sites
Build a growing list of unique domains with optional metadata (title, first seen).`,
    allowedTools: ["browse_page", "extract_content", "http_request", "store_memory", "get_memory", "write_file", "read_file", "list_dir", "complete"],
    scheduleCron: "0 0 * * *",
    maxRuntimeMinutes: 90,
    maxTokensPerRun: 80000,
    maxSpendCents: 250,
    startupActions: [{ action: "discover_domains", seeds: [] }],
  },
  {
    name: "Email Finder",
    description: "Finds and collects email addresses from websites or a given topic.",
    systemPrompt: `You are an email finder agent. Your job is to:
- Visit websites (from user instructions, memory, or search results) and extract email addresses
- Use browse_page to open pages and extract_content to get text; identify emails with a simple pattern (e.g. something@domain)
- Store found emails in memory with store_memory and write a report file (e.g. emails_found.txt or .csv)
- Respect user instructions: if the user sends a message (e.g. "search this URL" or "find emails about X"), prioritize that
- Do not invent or guess emails; only record addresses you actually see on the page
Work methodically. Check get_memory for user_message or other prior state before starting.`,
    allowedTools: ["browse_page", "extract_content", "http_request", "store_memory", "get_memory", "write_file", "read_file", "list_dir", "complete"],
    scheduleCron: null,
    maxRuntimeMinutes: 60,
    maxTokensPerRun: 60000,
    maxSpendCents: 200,
    startupActions: [{ action: "start", goal: "Find and collect email addresses from the web" }],
  },
];

async function main() {
  const existing = await prisma.botTemplate.findMany({ select: { name: true } });
  const names = new Set(existing.map((x) => x.name));
  for (const t of templates) {
    if (names.has(t.name)) continue;
    await prisma.botTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        systemPrompt: t.systemPrompt,
        allowedTools: t.allowedTools,
        scheduleCron: t.scheduleCron,
        maxRuntimeMinutes: t.maxRuntimeMinutes,
        maxTokensPerRun: t.maxTokensPerRun,
        maxSpendCents: t.maxSpendCents,
        startupActions: t.startupActions as object,
      },
    });
    names.add(t.name);
  }
  console.log("Seeded bot templates");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
