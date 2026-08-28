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

const locale = process.env.PORTFOLIO_LOCALE ?? "en";
const variants = {
  en: {
    browserLocale: "en-US",
    suffix: "",
    signedIn: "You are signed in.",
    accounts: {
      customer: "Fill customer account",
      owner: "Fill owner account",
      staff: "Fill staff account",
    },
    home: "One clear flow from booking to field work",
    booking: {
      title: "How can we help?",
      serviceGroup: "Choose a service",
      service: /Home cleaning/,
      dateGroup: "Visit date",
      timeGroup: "Available times",
      timeHeading: "Available times",
      confirm: "Request this time",
      confirmed: "We received your request",
    },
    staff: {title: "My assigned work", confirm: "Confirm", confirmed: "Confirmed"},
    dashboard: "Operations dashboard",
    calendar: "Booking calendar",
  },
  ko: {
    browserLocale: "ko-KR",
    suffix: "-ko",
    signedIn: "로그인했습니다.",
    accounts: {customer: "고객 계정 입력", owner: "오너 계정 입력", staff: "직원 계정 입력"},
    home: "예약부터 현장 운영까지, 한 흐름으로",
    booking: {
      title: "어떤 도움이 필요하세요?",
      serviceGroup: "서비스를 선택하세요",
      service: /홈 클리닝/,
      dateGroup: "방문 날짜",
      timeGroup: "가능한 시간",
      timeHeading: "가능한 시간",
      confirm: "이 일정으로 예약 요청",
      confirmed: "예약 요청을 받았어요",
    },
    staff: {title: "내 배정 업무", confirm: "예약 확정", confirmed: "확정"},
    dashboard: "운영 대시보드",
    calendar: "예약 캘린더",
  },
};
const variant = variants[locale];
if (!variant) {
  throw new Error(`Unsupported PORTFOLIO_LOCALE: ${locale}. Use en or ko.`);
}

const outputDirectory = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
const outputPath = join(outputDirectory, `serviceops-demo${variant.suffix}.gif`);
const framesDirectory = await mkdtemp(join(tmpdir(), `serviceops-demo-${locale}-`));
await mkdir(outputDirectory, {recursive: true});

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: {width: 1280, height: 720},
  colorScheme: "light",
  locale: variant.browserLocale,
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
  await page.goto(`${baseURL}/${locale}/login`);
  await page.getByRole("button", {name: accountLabel}).click();
  await page.locator("form button[type='submit']").click();
  await page.getByText(variant.signedIn).waitFor();
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
  await page.goto(`${baseURL}/${locale}`);
  await page.getByRole("heading", {name: variant.home}).waitFor();
  await waitForPage();
  await capture(90);

  await signIn(variant.accounts.customer);
  await page.goto(`${baseURL}/${locale}/booking`);
  await page.getByRole("heading", {name: variant.booking.title}).waitFor();
  const serviceGroup = page.getByRole("radiogroup", {name: variant.booking.serviceGroup});
  await serviceGroup.getByRole("radio", {name: variant.booking.service}).click();
  await waitForPage();
  await capture(90);

  const dateRadios = page
    .getByRole("radiogroup", {name: variant.booking.dateGroup})
    .getByRole("radio");
  let selectedSlot = false;
  for (let index = 0; index < (await dateRadios.count()); index += 1) {
    await dateRadios.nth(index).click();
    const availableSlots = page
      .getByRole("radiogroup", {name: variant.booking.timeGroup})
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
  await page.getByRole("heading", {name: variant.booking.timeHeading}).scrollIntoViewIfNeeded();
  await capture(90);

  await page.getByRole("button", {name: variant.booking.confirm}).click();
  const confirmation = page.getByText(variant.booking.confirmed);
  await confirmation.waitFor();
  await confirmation.scrollIntoViewIfNeeded();
  await capture(120);

  await signIn(variant.accounts.staff);
  await page.goto(`${baseURL}/${locale}/staff/bookings`);
  await page.getByRole("heading", {name: variant.staff.title}).waitFor();
  await waitForPage();
  await capture(90);
  const staffBooking = page
    .locator("article")
    .filter({has: page.getByRole("button", {name: variant.staff.confirm})})
    .first();
  if (await staffBooking.isVisible()) {
    await staffBooking.getByRole("button", {name: variant.staff.confirm}).click();
    await page
      .locator("article")
      .getByText(variant.staff.confirmed, {exact: true})
      .first()
      .waitFor();
    await capture(90);
  }

  await signIn(variant.accounts.owner);
  await page.goto(`${baseURL}/${locale}/owner/dashboard`);
  await page.getByRole("heading", {name: variant.dashboard}).waitFor();
  await waitForPage();
  await capture(120);

  await page.goto(`${baseURL}/${locale}/owner/calendar`);
  await page.getByRole("heading", {name: variant.calendar}).waitFor();
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
