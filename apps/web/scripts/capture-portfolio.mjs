import {chromium} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const baseURL = process.env.PORTFOLIO_BASE_URL;
if (!baseURL) {
  throw new Error("PORTFOLIO_BASE_URL is required.");
}

const outputDirectory = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
await mkdir(outputDirectory, {recursive: true});

const browser = await chromium.launch();

async function createPage(viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  return {context, page: await context.newPage()};
}

async function signIn(page, accountLabel) {
  await page.goto(`${baseURL}/ko/login`);
  await page.getByRole("button", {name: accountLabel}).click();
  await page.locator("form button[type='submit']").click();
  await page.getByText("로그인했습니다.").waitFor();
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
    await signIn(page, "고객 계정 입력");
    await preparePage(page, "/ko/booking", "어떤 도움이 필요하세요?");
    await save(page, "customer-booking-mobile.png");
    await context.close();
  }

  {
    const {context, page} = await createPage({width: 1440, height: 1050});
    await signIn(page, "오너 계정 입력");
    await preparePage(page, "/ko/owner/dashboard", "운영 대시보드");
    await save(page, "owner-dashboard-desktop.png", true);
    await preparePage(page, "/ko/owner/calendar", "예약 캘린더");
    await save(page, "owner-calendar-desktop.png", true);
    await context.close();
  }

  {
    const {context, page} = await createPage({width: 390, height: 844});
    await signIn(page, "직원 계정 입력");
    await preparePage(page, "/ko/staff/bookings", "내 배정 업무");
    await save(page, "staff-bookings-mobile.png");
    await context.close();
  }
} finally {
  await browser.close();
}
