import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
let browser;

(async () => {
  fs.mkdirSync(".artifacts", { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const root = process.env.PORTAL_URL || "http://localhost:3001";
  const routes = [
    "/competition",
    "/competition/CMP-2026-0001/run-match",
    "/event-management",
    "/event-management/create",
    "/user-management",
    "/pet-management",
    "/sponsorship-brand",
    "/event-management/event-registration",
    "/event-management/committee-registration",
    "/event-management/partner-registration",
    "/event-management/doorprize-drawing",
    "/report",
    "/competition/CMP-2026-0001/drawing",
    "/competition/CMP-2026-0002/contest",
    "/competition/CMP-2026-0003/time-trial",
    "/competition/CMP-2026-0004/run-match",
  ];
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const response = await page.goto(root + route, {
        waitUntil: "networkidle",
      });
      assert(response.ok(), route + " returned " + response.status());
      assert(await page.locator("main h1").count(), route + " missing heading");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) {
        await page.screenshot({
          path: ".artifacts/overflow.png",
          fullPage: true,
        });
        console.log(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter((el) => el.getBoundingClientRect().right > innerWidth)
              .slice(0, 15)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                width: el.getBoundingClientRect().width,
              })),
          ),
        );
      }
      assert(!overflow, route + " overflows at " + width);
    }
    await page.goto(root + "/competition/CMP-2026-0001/run-match", {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: ".artifacts/race-" + width + ".png",
      fullPage: true,
    });
    assert(
      await page
        .locator(".pet-photo")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
      "Pet asset failed",
    );
    if (width === 360) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Competition", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "Mobile menu did not close",
      );
    }
  }
  await page.goto(root + "/competition/CMP-2026-0001/run-match", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Start Race", exact: true }).click();
  await page
    .getByRole("button", { name: "Capture Finish", exact: true })
    .waitFor({ timeout: 10000 });
  await page
    .getByRole("button", { name: "Capture Finish", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop Race", exact: true }).click();
  await page.getByLabel("Position for Mochi").selectOption("1");
  for (const name of ["Bruno", "Luna", "Coco"])
    await page.getByLabel("Position for " + name).selectOption("DNS");
  await page
    .getByRole("button", { name: "Save Race Result", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View Leaderboard", exact: true })
    .click();
  assert(
    await page.getByText("Saved Leaderboard", { exact: true }).isVisible(),
  );
  await page.goto(root + "/event-management/create", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Event Name").fill("Responsive Test Event");
  await page.getByLabel("Organizer", { exact: false }).fill("Petpet QA");
  await page.getByLabel("Start Date").fill("2026-10-01T09:00");
  await page.getByLabel("End Date").fill("2026-10-02T17:00");
  await page.getByLabel("Location", { exact: false }).first().fill("Jakarta");
  await page.getByLabel("Address").fill("JIExpo Kemayoran");
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await page.waitForURL("**/event-management");
  assert(
    await page.getByText("Responsive Test Event", { exact: true }).isVisible(),
  );
  await page
    .getByRole("searchbox", { name: "Event search" })
    .fill("does-not-exist");
  assert(await page.getByText("No records found", { exact: true }).isVisible());
  await page.goto(root + "/competition/CMP-2026-0002/contest", {
    waitUntil: "networkidle",
  });
  for (const pet of ["Mochi", "Bruno", "Luna", "Coco"]) {
    for (const criterion of ["Appearance", "Creativity", "Performance"]) {
      await page.getByLabel(criterion + " for " + pet).fill("80");
    }
  }
  await page.getByRole("button", { name: "Save Scores", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Final Standings" }).isVisible(),
  );
  await page.goto(root + "/event-management/doorprize-drawing", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Draw Winner", exact: true }).click();
  assert.notEqual(
    await page.locator(".prize-winner").textContent(),
    "Ready to draw",
  );
  await page.goto(root + "/competition/CMP-2026-0003/time-trial", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Start Race", exact: true }).click();
  await page
    .getByRole("button", { name: "Capture Finish", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Capture Finish", exact: true })
    .click();
  await page.getByRole("button", { name: "Stop Race", exact: true }).click();
  await page.getByLabel("Position for Mochi").selectOption("1");
  await page
    .getByRole("button", { name: "Save Race Result", exact: true })
    .click();
  await page
    .getByLabel("Time trial participant", { exact: true })
    .selectOption("PET-00132");
  assert(
    await page
      .getByRole("button", { name: "Start Race", exact: true })
      .isEnabled(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 64 responsive route checks, mobile navigation, race capture/save, time trial, judging, doorprize, event creation, filtering, images, and browser errors.",
  );
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exit(1);
});
