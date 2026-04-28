#!/usr/bin/env node
/**
 * check-alerts.js — Query D1 alerts, check scraped prices, send emails via Resend.
 * Run after scraping: pnpm check-alerts
 *
 * Requires:
 *   RESEND_API_KEY in .env.local (or env)
 *   wrangler d1 execute access (remote D1)
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
function loadEnv() {
  try {
    const envFile = readFileSync(join(__dirname, "../.env.local"), "utf8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch {}
}
loadEnv();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY");
  process.exit(1);
}

// Load scraped prices
const pricesPath = join(__dirname, "../data/scraped-prices.json");
const { prices: scrapedPrices, stores: storeMeta } = JSON.parse(readFileSync(pricesPath, "utf8"));

function getBestPrice(discId) {
  const entries = scrapedPrices[discId];
  if (!entries || entries.length === 0) return null;
  const inStock = entries.filter((e) => e.inStock);
  if (!inStock.length) return null;
  return Math.min(...inStock.map((e) => e.price));
}

function getBestUrl(discId) {
  const entries = scrapedPrices[discId];
  if (!entries) return "https://discdrop.net/disc/" + discId;
  const inStock = entries.filter((e) => e.inStock);
  if (!inStock.length) return "https://discdrop.net/disc/" + discId;
  const best = inStock.reduce((a, b) => (a.price <= b.price ? a : b));
  return best.url;
}

// Query all active alerts from D1
function queryAlerts() {
  const result = execSync(
    `npx wrangler d1 execute discdrop-alerts --remote --json --command "SELECT id, disc_id, email, target_price FROM alerts WHERE active = 1"`,
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(result);
  return parsed[0]?.results ?? [];
}

// Deactivate alert after triggering
function deactivateAlert(alertId) {
  execSync(
    `npx wrangler d1 execute discdrop-alerts --remote --command "UPDATE alerts SET active = 0, triggered_at = datetime('now') WHERE id = '${alertId}'"`,
    { encoding: "utf8" }
  );
}

async function notifyOwner(subject, message) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    console.error("OWNER_EMAIL not set — skipping failure notification");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DiscDrop <varsler@discdrop.net>",
        to: [ownerEmail],
        subject,
        text: message,
      }),
    });
    if (!res.ok) {
      console.error(`Failed to send owner notification: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Failed to send owner notification:", err);
  }
}

async function sendEmail(alert, currentPrice) {
  const { id, disc_id, email, target_price } = alert;
  const discUrl = `https://discdrop.net/disc/${disc_id}`;
  const unsubUrl = `https://discdrop.net/api/alerts/unsubscribe?id=${id}`;
  const bestStoreUrl = getBestUrl(disc_id);

  const discName = disc_id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DiscDrop <varsler@discdrop.net>",
      to: [email],
      subject: `Prisvarsel: ${discName} er nå kr ${currentPrice}`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #F5F2EB; padding: 32px 24px; border-radius: 12px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: 700; color: #1E3D2F;">Disc</span><span style="font-size: 28px; font-weight: 700; color: #B8E04A;">Drop</span>
          </div>
          <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 8px;">Prisvarslet ditt er utløst!</h1>
          <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
            <strong>${discName}</strong> er nå tilgjengelig til <strong style="color: #2D6A4F;">kr ${currentPrice}</strong> — under ditt mål på kr ${target_price}.
          </p>
          <a href="${bestStoreUrl}" style="display: inline-block; background: #2D6A4F; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
            Se tilbudet nå →
          </a>
          <p style="color: #555; font-size: 14px; margin: 0 0 8px;">
            Eller <a href="${discUrl}" style="color: #2D6A4F;">sammenlign alle priser på DiscDrop</a>.
          </p>
          <hr style="border: none; border-top: 1px solid #e0ddd4; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px; margin: 0;">
            Du mottok denne e-posten fordi du opprettet et prisvarsel på discdrop.net.<br/>
            <a href="${unsubUrl}" style="color: #aaa;">Avslutt varslet</a>
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to send email to ${email}:`, err);
    return false;
  }
  return true;
}

async function main() {
  console.log("Fetching active alerts from D1...");
  const alerts = queryAlerts();
  console.log(`Found ${alerts.length} active alert(s).`);

  let triggered = 0;
  for (const alert of alerts) {
    const currentPrice = getBestPrice(alert.disc_id);
    if (currentPrice == null) continue;
    if (currentPrice > alert.target_price) continue;

    console.log(`  Trigger: ${alert.disc_id} at kr ${currentPrice} (target kr ${alert.target_price}) → ${alert.email}`);
    const sent = await sendEmail(alert, currentPrice);
    if (sent) {
      deactivateAlert(alert.id);
      triggered++;
    }
  }

  console.log(`Done. Triggered ${triggered} alert(s).`);
}

main().catch(async (e) => {
  console.error(e);
  await notifyOwner(
    "DiscDrop: price alerts check FAILED",
    `The daily check-alerts.js run failed.\n\nError:\n${e?.stack || e?.message || String(e)}\n\nSee GitHub Actions logs for the full output.`
  );
  process.exit(1);
});
