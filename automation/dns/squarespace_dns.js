import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function getRootDomain(domain, rootOverride) {
  if (rootOverride) return rootOverride;
  const parts = domain.split(".");
  if (parts.length < 2) return domain;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function hostFromDomain(domain, rootDomain) {
  if (!domain.endsWith(rootDomain)) {
    throw new Error(`Domain ${domain} does not end with root ${rootDomain}`);
  }
  if (domain === rootDomain) {
    return "@";
  }
  return domain.slice(0, domain.length - rootDomain.length - 1);
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.fill(value);
      return;
    }
  }
  throw new Error(`Unable to find input for selectors: ${selectors.join(", ")}`);
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click();
      return;
    }
  }
  throw new Error(`Unable to find button for selectors: ${selectors.join(", ")}`);
}

async function ensureOnDnsSettings(page) {
  const dnsLink = page.getByRole("link", { name: /dns settings/i });
  if ((await dnsLink.count()) > 0) {
    await dnsLink.first().click();
    return;
  }
  const dnsButton = page.getByRole("button", { name: /dns settings/i });
  if ((await dnsButton.count()) > 0) {
    await dnsButton.first().click();
    return;
  }

  console.log("Could not find DNS Settings link automatically.");
  console.log("Please navigate to the DNS settings page for the domain in the open browser.");
  await waitForEnter("Press Enter here once the DNS settings page is open...");
}

async function openAddRecord(page) {
  const selectors = [
    page.getByRole("button", { name: /add record/i }),
    page.getByRole("button", { name: /add dns/i }),
    page.getByRole("button", { name: /add a record/i }),
    page.getByRole("button", { name: /add new record/i }),
    page.getByRole("button", { name: /add/i }),
    page.getByRole("link", { name: /add record/i }),
    page.getByRole("link", { name: /add/i }),
    page.locator("[data-test*='add'][data-test*='record']"),
    page.locator("[aria-label*='Add'][aria-label*='record']"),
    page.locator("button:has-text('Add Record')"),
    page.locator("button:has-text('Add record')"),
    page.locator("button:has-text('Add')"),
  ];

  for (const selector of selectors) {
    if ((await selector.count()) > 0) {
      await selector.first().click();
      return;
    }
  }

  throw new Error("Unable to find an Add Record button.");
}

async function findDialog(page) {
  const dialog = page.locator("[role='dialog']").first();
  if ((await dialog.count()) > 0) return dialog;
  const form = page.locator("form").first();
  if ((await form.count()) > 0) return form;
  return page;
}

async function trySelectType(dialog) {
  const select = dialog.locator("select").first();
  if ((await select.count()) > 0) {
    await select.selectOption({ label: "A" }).catch(() => {});
  }
}

async function fillHostAndValue(dialog, host, value) {
  const hostLabel = dialog.getByLabel(/host|name|subdomain/i);
  if ((await hostLabel.count()) > 0) {
    await hostLabel.first().fill(host);
  }
  const valueLabel = dialog.getByLabel(/value|data|points|ip/i);
  if ((await valueLabel.count()) > 0) {
    await valueLabel.first().fill(value);
    return;
  }
  const hostPlaceholder = dialog.locator("input[placeholder*='Host'], input[placeholder*='host'], input[placeholder*='Name'], input[placeholder*='name']");
  if ((await hostPlaceholder.count()) > 0) {
    await hostPlaceholder.first().fill(host);
  }
  const valuePlaceholder = dialog.locator("input[placeholder*='Value'], input[placeholder*='value'], input[placeholder*='IP'], input[placeholder*='ip'], input[placeholder*='Points']");
  if ((await valuePlaceholder.count()) > 0) {
    await valuePlaceholder.first().fill(value);
    return;
  }

  const inputs = dialog.locator("input");
  const inputCount = await inputs.count();
  if (inputCount >= 2) {
    await inputs.nth(0).fill(host);
    await inputs.nth(1).fill(value);
    return;
  }
  throw new Error("Unable to locate host/value inputs.");
}

async function saveRecord(dialog) {
  const buttons = [
    dialog.getByRole("button", { name: /save/i }),
    dialog.getByRole("button", { name: /add/i }),
    dialog.getByRole("button", { name: /create/i }),
  ];
  for (const button of buttons) {
    if ((await button.count()) > 0) {
      await button.first().click();
      return;
    }
  }
  throw new Error("Unable to find Save/Add button.");
}

async function recordExists(page, host) {
  const row = page.locator("tr", { hasText: host }).filter({ hasText: "A" });
  if ((await row.count()) > 0) {
    return true;
  }
  const listItem = page.locator("div", { hasText: host }).filter({ hasText: "A" });
  return (await listItem.count()) > 0;
}

async function manualAddFallback(host, ip) {
  console.log("");
  console.log("Manual step needed:");
  console.log(`1) Click "Add Record" in the Squarespace DNS UI.`);
  console.log("2) Choose type A.");
  console.log(`3) Host: ${host}`);
  console.log(`4) Value: ${ip}`);
  console.log("5) Save the record.");
  await waitForEnter("Press Enter once the record is saved...");
}

async function upsertARecord(page, host, ip) {
  if (await recordExists(page, host)) {
    const existingRow = page.locator("tr", { hasText: host }).filter({ hasText: "A" });
    if ((await existingRow.count()) > 0) {
      await existingRow.first().click();
    }
  } else {
    try {
      await openAddRecord(page);
    } catch (err) {
      await manualAddFallback(host, ip);
      return;
    }
  }

  const dialog = await findDialog(page);
  try {
    await trySelectType(dialog);
    await fillHostAndValue(dialog, host, ip);
    await saveRecord(dialog);
    await page.waitForTimeout(1000);
  } catch (err) {
    await manualAddFallback(host, ip);
  }
}

async function run() {
  const email = requireEnv("SS_EMAIL");
  const password = requireEnv("SS_PASSWORD");
  const dnsUrl = process.env.SS_DNS_URL;
  const domain = requireEnv("DOMAIN");
  const apiDomain = requireEnv("API_DOMAIN");
  const publicIp = requireEnv("PUBLIC_IP");
  const rootDomain = getRootDomain(domain, process.env.ROOT_DOMAIN);

  const records = [
    { host: hostFromDomain(domain, rootDomain), ip: publicIp },
    { host: hostFromDomain(apiDomain, rootDomain), ip: publicIp },
  ];

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://account.squarespace.com/", { waitUntil: "domcontentloaded" });
  await fillFirst(page, ["input[type='email']", "input[name='email']"], email);
  await fillFirst(page, ["input[type='password']", "input[name='password']"], password);
  await clickFirst(page, ["button[type='submit']", "button:has-text('Log In')", "button:has-text('Sign In')"]);

  await page.waitForTimeout(2000);
  const otpInputs = page.locator("input[type='tel'], input[name*='otp'], input[autocomplete='one-time-code']");
  if ((await otpInputs.count()) > 0) {
    console.log("MFA/OTP detected. Complete it in the browser window.");
    await waitForEnter("Press Enter after completing MFA/OTP...");
  }

  if (dnsUrl) {
    await page.goto(dnsUrl, { waitUntil: "domcontentloaded" });
  } else {
    await page.goto("https://account.squarespace.com/domains/managed", { waitUntil: "domcontentloaded" });
    const domainLink = page.getByRole("link", { name: new RegExp(domain, "i") });
    if ((await domainLink.count()) === 0) {
      throw new Error(`Domain ${domain} not found. Make sure it is in the Squarespace account.`);
    }
    await domainLink.first().click();
    await ensureOnDnsSettings(page);
  }

  for (const record of records) {
    console.log(`Upserting A record: ${record.host} -> ${record.ip}`);
    await upsertARecord(page, record.host, record.ip);
  }

  console.log("DNS automation completed.");
  await waitForEnter("Press Enter to close the browser...");
  await browser.close();
}

run().catch((err) => {
  console.error("DNS automation failed:", err.message);
  process.exit(1);
});
