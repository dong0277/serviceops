import {chromium} from "@playwright/test";
import {mkdir} from "node:fs/promises";
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
    headings: {
      booking: "How can we help?",
      dashboard: "Operations dashboard",
      calendar: "Booking calendar",
      staff: "My assigned work",
    },
  },
  ko: {
    browserLocale: "ko-KR",
    suffix: "-ko",
    signedIn: "로그인했습니다.",
    accounts: {customer: "고객 계정 입력", owner: "오너 계정 입력", staff: "직원 계정 입력"},
    headings: {
      booking: "어떤 도움이 필요하세요?",
      dashboard: "운영 대시보드",
      calendar: "예약 캘린더",
      staff: "내 배정 업무",
    },
  },
};
const variant = variants[locale];
if (!variant) {
  throw new Error(`Unsupported PORTFOLIO_LOCALE: ${locale}. Use en or ko.`);
}

const outputDirectory = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
await mkdir(outputDirectory, {recursive: true});

const browser = await chromium.launch();

async function createPage(viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    locale: variant.browserLocale,
    timezoneId: "Asia/Seoul",
  });
  return {context, page: await context.newPage()};
}

async function signIn(page, accountLabel) {
  await page.goto(`${baseURL}/${locale}/login`);
  await page.getByRole("button", {name: accountLabel}).click();
  await page.locator("form button[type='submit']").click();
  await page.getByText(variant.signedIn).waitFor();
}

async function preparePage(page, path, heading) {
  await page.goto(`${baseURL}${path}`);
  await page.getByRole("heading", {name: heading, level: 1}).waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

async function save(page, name, fullPage = false) {
  await page.screenshot({
    path: `${outputDirectory}${name}`,
    fullPage,
    animations: "disabled",
  });
}

try {
  {
    const {context, page} = await createPage({width: 390, height: 844});
    await signIn(page, variant.accounts.customer);
    await preparePage(page, `/${locale}/booking`, variant.headings.booking);
    await save(page, `customer-booking-mobile${variant.suffix}.png`);
    await context.close();
  }

  {
    const {context, page} = await createPage({width: 1440, height: 1050});
    await signIn(page, variant.accounts.owner);
    await preparePage(page, `/${locale}/owner/dashboard`, variant.headings.dashboard);
    await save(page, `owner-dashboard-desktop${variant.suffix}.png`, true);
    await preparePage(page, `/${locale}/owner/calendar`, variant.headings.calendar);
    await save(page, `owner-calendar-desktop${variant.suffix}.png`, true);
    await context.close();
  }

  {
    const {context, page} = await createPage({width: 390, height: 844});
    await signIn(page, variant.accounts.staff);
    await preparePage(page, `/${locale}/staff/bookings`, variant.headings.staff);
    await save(page, `staff-bookings-mobile${variant.suffix}.png`);
    await context.close();
  }
} finally {
  await browser.close();
}
