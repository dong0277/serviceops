import {chromium} from "@playwright/test";
import {spawnSync} from "node:child_process";
import {mkdir, mkdtemp, rm, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const baseURL = process.env.PORTFOLIO_BASE_URL;
if (!baseURL) {
  throw new Error("PORTFOLIO_BASE_URL is required.");
}

const outputDirectory = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
const outputPath = join(outputDirectory, "serviceops-demo.gif");
const framesDirectory = await mkdtemp(join(tmpdir(), "serviceops-demo-"));
await mkdir(outputDirectory, {recursive: true});

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: {width: 1280, height: 720},
  colorScheme: "light",
  locale: "en-US",
  timezoneId: "Asia/Seoul",
});
const page = await context.newPage();
const frames = [];

async function waitForPage() {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

async function capture(delay) {
  const path = join(framesDirectory, `${String(frames.length).padStart(2, "0")}.png`);
  await page.screenshot({path, animations: "disabled"});
  frames.push({path, delay});
}

async function signIn(accountLabel) {
  await context.clearCookies();
  await page.goto(`${baseURL}/en/login`);
  await page.getByRole("button", {name: accountLabel}).click();
  await page.locator("form button[type='submit']").click();
  await page.getByText("You are signed in.").waitFor();
}

function createGif({width, colors}) {
  const args = [];
  for (const frame of frames) {
    args.push("-delay", String(frame.delay), frame.path);
  }
  args.push(
    "-resize",
    `${width}x`,
    "-alpha",
    "remove",
    "-dither",
    "None",
    "-colors",
    String(colors),
    "-loop",
    "0",
    "-layers",
    "Optimize",
    "-strip",
    outputPath,
  );
  const result = spawnSync("magick", args, {stdio: "inherit"});
  if (result.error) {
    throw new Error(`ImageMagick could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`ImageMagick exited with status ${result.status}.`);
  }
}

try {
  await page.goto(`${baseURL}/en`);
  await page.getByRole("heading", {name: "One clear flow from booking to field work"}).waitFor();
  await waitForPage();
  await capture(90);

  await signIn("Fill customer account");
  await page.goto(`${baseURL}/en/booking`);
  await page.getByRole("heading", {name: "How can we help?"}).waitFor();
  const serviceGroup = page.getByRole("radiogroup", {name: "Choose a service"});
  await serviceGroup.getByRole("radio", {name: /Home cleaning/}).click();
  await waitForPage();
  await capture(90);

  const dateRadios = page.getByRole("radiogroup", {name: "Visit date"}).getByRole("radio");
  let selectedSlot = false;
  for (let index = 0; index < (await dateRadios.count()); index += 1) {
    await dateRadios.nth(index).click();
    const availableSlots = page
      .getByRole("radiogroup", {name: "Available times"})
      .getByRole("radio");
    if (await availableSlots.count()) {
      await availableSlots.first().click();
      selectedSlot = true;
      break;
    }
  }
  if (!selectedSlot) {
    throw new Error("No seeded booking slot was available for the demo.");
  }
  await page.getByRole("heading", {name: "Available times"}).scrollIntoViewIfNeeded();
  await capture(90);

  await page.getByRole("button", {name: "Request this time"}).click();
  const confirmation = page.getByText("We received your request");
  await confirmation.waitFor();
  await confirmation.scrollIntoViewIfNeeded();
  await capture(120);

  await signIn("Fill staff account");
  await page.goto(`${baseURL}/en/staff/bookings`);
  await page.getByRole("heading", {name: "My assigned work"}).waitFor();
  await waitForPage();
  await capture(90);
  const staffBooking = page
    .locator("article")
    .filter({has: page.getByRole("button", {name: "Confirm"})})
    .first();
  if (await staffBooking.isVisible()) {
    await staffBooking.getByRole("button", {name: "Confirm"}).click();
    await page.locator("article").getByText("Confirmed", {exact: true}).first().waitFor();
    await capture(90);
  }

  await signIn("Fill owner account");
  await page.goto(`${baseURL}/en/owner/dashboard`);
  await page.getByRole("heading", {name: "Operations dashboard"}).waitFor();
  await waitForPage();
  await capture(120);

  await page.goto(`${baseURL}/en/owner/calendar`);
  await page.getByRole("heading", {name: "Booking calendar"}).waitFor();
  await waitForPage();
  await capture(140);

  createGif({width: 960, colors: 256});
  if ((await stat(outputPath)).size > 8 * 1024 * 1024) {
    createGif({width: 800, colors: 128});
  }
} finally {
  await context.close();
  await browser.close();
  await rm(framesDirectory, {recursive: true, force: true});
}
