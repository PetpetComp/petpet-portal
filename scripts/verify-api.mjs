import { createServer } from "node:http";
import { cp, mkdtemp, symlink, unlink, rm } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const userId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const competitionId = "30000000-0000-4000-8000-000000000001";
const speciesId = "40000000-0000-4000-8000-000000000001";
const user = {
  uuid: userId,
  username: "tester",
  email: "tester@example.test",
  first_name: "Portal",
  last_name: "Tester",
  status: "ACTIVE",
  profile: {},
  roles: [{ code: "ADMIN", name: "Administrator" }],
};
const users = [user];
const events = [
  {
    uuid: eventId,
    name: "API Test Event",
    organization_uuid: speciesId,
    start_at: "2026-09-20T03:00:00+00:00",
    end_at: "2026-09-20T10:00:00+00:00",
    timezone: "Asia/Jakarta",
    status: "DRAFT",
  },
];
const competitions = [
  {
    uuid: competitionId,
    event_uuid: eventId,
    name: "API Test Competition",
    competition_type_uuid: speciesId,
    scheduled_start_at: "2026-09-20T04:00:00+00:00",
    scheduled_end_at: "2026-09-20T05:00:00+00:00",
    status: "DRAFT",
  },
];
const pets = [];
const sponsors = [];
const periods = [];
const requests = [];
let sequence = 10;
const uuid = () =>
  "50000000-0000-4000-8000-" + String(sequence++).padStart(12, "0");
const stub = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3107");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const path = new URL(req.url, "http://localhost").pathname.replace(
    /^\/api/,
    "",
  );
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  requests.push({ path, method: req.method, body });
  const send = (data, status = 200, message = "OK") => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: status < 400, message, data }));
  };
  const list = (data) =>
    send({
      items: data,
      meta: {
        current_page: 1,
        per_page: 100,
        last_page: 1,
        total: data.length,
      },
    });
  if (path === "/auth/login") {
    if (body.email !== user.email || body.password !== "test-password")
      return send(null, 401, "Invalid email or password.");
    return send({
      access_token: "local-test-token",
      expires_in: 3600,
      token_type: "bearer",
      user,
    });
  }
  if (req.headers.authorization !== "Bearer local-test-token")
    return send(null, 401, "Unauthenticated.");
  if (path === "/auth/me") return send(user);
  if (path === "/auth/logout") return send(null);
  if (path === "/auth/roles")
    return send([{ uuid: speciesId, code: "ADMIN", name: "Administrator" }]);
  if (req.method === "GET") {
    if (path === "/users") return list(users);
    if (path === "/events") return list(events);
    if (path === "/pets") return list(pets);
    if (path === "/sponsors") return list(sponsors);
    if (path === "/events/" + eventId + "/competitions")
      return list(competitions);
    if (path.endsWith("/registration-periods")) return send(periods);
    return send([]);
  }
  if (req.method === "POST" && path === "/users") {
    if (body.first_name === "Rejected") {
      res.writeHead(422, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          success: false,
          message: "Validation error.",
          errors: { email: ["Email already exists."] },
        }),
      );
    }
    const record = { uuid: uuid(), ...body, profile: {}, roles: [] };
    users.push(record);
    return send(record, 201);
  }
  if (req.method === "PATCH" && path.startsWith("/users/")) {
    const record = users.find((item) => path === "/users/" + item.uuid);
    Object.assign(record, body);
    return send(record);
  }
  if (req.method === "DELETE" && path.startsWith("/users/")) {
    const index = users.findIndex((item) => path === "/users/" + item.uuid);
    users.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "POST" && path === "/pets") {
    const record = {
      uuid: uuid(),
      ...body,
      species_uuid: body.species_id,
      welfare_status: "HEALTHY",
    };
    pets.push(record);
    return send(record, 201);
  }
  if (req.method === "POST" && path === "/sponsors") {
    const record = { uuid: uuid(), ...body, status: "ACTIVE" };
    sponsors.push(record);
    return send(record, 201);
  }
  if (req.method === "POST" && path.endsWith("/registration-periods")) {
    const record = { uuid: uuid(), ...body, competition_uuid: competitionId };
    periods.push(record);
    return send(record, 201);
  }
  return send(null, 404, "Fixture endpoint not configured.");
});
stub.listen(0, "127.0.0.1");
await once(stub, "listening");
const upstreamPort = stub.address().port;
const port = 3107;
const base = "http://127.0.0.1:" + port;
// A separate project directory keeps tests independent of an active dev server.
const tempRoot = resolve(tmpdir());
const testDirectory = await mkdtemp(join(tempRoot, "petpet-api-e2e-"));
for (const path of [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
]) {
  await cp(resolve(path), join(testDirectory, path), { recursive: true });
}
await symlink(
  resolve("node_modules"),
  join(testDirectory, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
console.log("Starting isolated browser test server...");
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: testDirectory,
    env: {
      ...process.env,
      NEXT_PUBLIC_BACKEND_BASE_URL: "http://127.0.0.1:" + upstreamPort + "/api",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
next.stdout.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});
next.stderr.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(base + "/sign-in");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    if (next.exitCode !== null) throw new Error("Next exited: " + logs);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next server did not become ready: " + logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  const apiRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(base + "/user-management");
  await page.waitForURL("**/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Invalid email or password." })
    .waitFor();
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/competition");
  await page.getByRole("button", { name: "Open account menu" }).waitFor();
  assert.ok(
    (await context.cookies()).some(
      (cookie) => cookie.name === "_petpet" && !cookie.httpOnly,
    ),
  );
  assert.ok((await page.evaluate(() => document.cookie)).includes("_petpet="));
  assert.ok(
    await page
      .getByRole("button", { name: "Open account menu" })
      .textContent()
      .then((text) => text.includes("Portal Tester")),
  );
  console.log(
    "PASS login, invalid credentials, Bearer cookie session, real profile",
  );
  await page.goto(base + "/user-management/create");
  await page.getByLabel("Username", { exact: false }).fill("newuser");
  await page.getByLabel("Email", { exact: false }).fill("new@example.test");
  await page.getByLabel("First name", { exact: false }).fill("Rejected");
  await page.getByRole("button", { name: "Save User", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Email already exists." })
    .waitFor();
  assert.ok(page.url().endsWith("/create"));
  await page.getByLabel("First name", { exact: false }).fill("Created");
  await page.getByRole("button", { name: "Save User", exact: true }).click();
  await page.waitForURL("**/user-management");
  await page.getByRole("row").filter({ hasText: "new@example.test" }).waitFor();
  const created = users.find((item) => item.username === "newuser");
  assert.ok(created?.uuid);
  await page.reload();
  await page.getByRole("row").filter({ hasText: "new@example.test" }).waitFor();
  await page.goto(base + "/user-management/" + created.uuid + "/edit");
  await page.getByLabel("First name", { exact: false }).fill("Updated");
  await page.getByRole("button", { name: "Save User", exact: true }).click();
  await page.waitForURL("**/user-management");
  await page
    .getByRole("row")
    .filter({ hasText: "new@example.test" })
    .getByRole("button", { name: "Delete Updated" })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: "new@example.test" })
    .waitFor({ state: "detached" });
  assert.equal(users.length, 1);
  console.log(
    "PASS user create, validation failure, persistence, edit, delete",
  );
  await page.goto(base + "/pet-management/create");
  await page.getByLabel("Pet name", { exact: false }).fill("Test Pet");
  await page.getByLabel("Species ID (UUID)", { exact: false }).fill(speciesId);
  await page.getByLabel("Weight (grams)", { exact: true }).fill("1250.5");
  await page.getByRole("button", { name: "Save Pet", exact: true }).click();
  await page.waitForURL("**/pet-management");
  assert.equal(pets[0].weight_grams, 1250.5);
  assert.equal(pets[0].species_id, speciesId);
  await page.goto(base + "/sponsorship-brand/create");
  await page.getByLabel("Brand name", { exact: false }).fill("API Brand");
  await page.getByRole("button", { name: "Save Brand", exact: true }).click();
  await page.waitForURL("**/sponsorship-brand");
  assert.equal(sponsors[0].brand_name, "API Brand");
  console.log("PASS pet numeric/UUID mapping and sponsor creation");
  await page.goto(
    base + "/event-management/" + eventId + "/competitions/" + competitionId,
  );
  const section = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Registration periods",
      exact: true,
    }),
  });
  await section
    .getByLabel("Period type", { exact: false })
    .selectOption("ONLINE");
  await section.getByLabel("Price", { exact: false }).fill("150000");
  await section
    .getByLabel("Registration starts", { exact: false })
    .fill("2026-09-16T09:00");
  await section
    .getByLabel("Registration ends", { exact: false })
    .fill("2026-09-19T17:00");
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await section.getByRole("button", { name: "Edit", exact: true }).waitFor();
  assert.equal(periods[0].price, 150000);
  assert.equal(periods[0].period_type, "ONLINE");
  assert.ok(periods[0].registration_start_at.endsWith("Z"));
  console.log("PASS competition registration-period creation");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/sponsorship-brand/create");
  await page.getByRole("button", { name: "Save Brand", exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile layout overflows",
  );
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/sign-in");
  assert.ok(
    !(await context.cookies()).some(
      (cookie) => cookie.name === "_petpet" && cookie.value,
    ),
  );
  await page.goto(base + "/user-management");
  await page.waitForURL("**/sign-in");
  assert.deepEqual(pageErrors, []);
  assert.ok(
    apiRequests.some((url) =>
      url.startsWith("http://127.0.0.1:" + upstreamPort + "/api/auth/login"),
    ),
  );
  assert.ok(
    !apiRequests.some((url) => url.includes("/api/backend/")),
    "Browser must call backend directly",
  );
  console.log(
    "PASS mobile layout, logout, protected routes; no browser errors",
  );
  console.log("All API browser checks passed against local fixtures.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  next.kill();
  stub.closeAllConnections();
  stub.close();
  if (next.exitCode === null)
    await Promise.race([
      once(next, "exit"),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  // Remove only the temporary project we created, and unlink shared dependencies first.
  if (
    dirname(resolve(testDirectory)) === tempRoot &&
    basename(testDirectory).startsWith("petpet-api-e2e-")
  ) {
    await unlink(join(testDirectory, "node_modules"));
    await rm(testDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 300,
    });
  }
}
