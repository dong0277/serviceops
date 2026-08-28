import {expect, test, type Page} from "@playwright/test";

const suffix = `${Date.now()}-${process.pid}`;
const customerName = `E2E Customer ${suffix}`;
const customerEmail = `e2e.customer.${suffix}@serviceops.test`;
const password = "ServiceOps-E2E-2026!";
const serviceName = `E2E Service ${suffix}`;
const apiBaseURL = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";

async function signIn(page: Page, email: string, accountPassword = password) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword);
  await page.locator("form button[type='submit']").click();
  await expect(page.getByText("You are signed in.")).toBeVisible();
}

async function signInDemo(page: Page, role: "owner" | "staff") {
  await page.goto("/en/login");
  await page
    .getByRole("button", {
      name: role === "owner" ? "Fill owner account" : "Fill staff account",
    })
    .click();
  await page.locator("form button[type='submit']").click();
  await expect(page.getByText("You are signed in.")).toBeVisible();
}

test.describe.serial("ServiceOps critical role flows", () => {
  test("customer registers and creates a booking", async ({page}) => {
    await page.goto("/en/login");
    await page.getByRole("button", {name: "Customer registration", exact: true}).first().click();
    await page.getByLabel("Name").fill(customerName);
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel("Organization slug").fill("demo-services");
    await page.locator("form button[type='submit']").click();
    await expect(page.getByText("Your customer account was created and signed in.")).toBeVisible();

    await page.goto("/en/booking");
    const serviceGroup = page.getByRole("radiogroup", {name: "Choose a service"});
    await serviceGroup.getByRole("radio", {name: /Home cleaning/}).click();

    const dateRadios = page.getByRole("radiogroup", {name: "Visit date"}).getByRole("radio");
    let selectedHanaSlot = false;
    for (let index = 0; index < (await dateRadios.count()); index += 1) {
      await dateRadios.nth(index).click();
      const hanaSlots = page
        .getByRole("radiogroup", {name: "Available time"})
        .getByRole("radio")
        .filter({hasText: "Hana Lee"});
      try {
        await expect(hanaSlots.first()).toBeVisible({timeout: 3000});
        await hanaSlots.first().click();
        selectedHanaSlot = true;
        break;
      } catch {
        // Continue through the seven-day window until Hana has an available slot.
      }
    }
    expect(selectedHanaSlot).toBe(true);
    await page.getByRole("button", {name: "Request this time"}).click();
    await expect(page.getByText("We received your request")).toBeVisible();
    await expect(page.getByText("Requested").last()).toBeVisible();
  });

  test("staff views the assigned booking and advances its status", async ({page}) => {
    await signInDemo(page, "staff");
    await page.goto("/en/staff/bookings");
    const booking = page.locator("article").filter({hasText: customerName});
    await expect(booking).toBeVisible();
    await booking.getByRole("button", {name: "Confirm"}).click();
    await expect(booking.getByText("Confirmed")).toBeVisible();
  });

  test("customer views and cancels the eligible booking", async ({page}) => {
    await signIn(page, customerEmail);
    await page.goto("/en/booking");
    const bookingHistory = page.getByRole("heading", {name: "My bookings"}).locator("../..");
    await expect(bookingHistory.getByText("Confirmed")).toBeVisible();
    await bookingHistory.getByRole("button", {name: "Cancel booking"}).first().click();
    await expect(page.getByText("Your booking was cancelled")).toBeVisible();
  });

  test("owner creates a service and filters bookings", async ({page}) => {
    await signInDemo(page, "owner");
    await page.goto("/en/owner/services");
    await page.getByRole("button", {name: "New service"}).click();
    await page.getByLabel("Service name").fill(serviceName);
    await page.getByLabel("Description").fill("Created by the deterministic E2E flow.");
    await page.getByLabel("Duration in minutes").fill("45");
    await page.getByLabel("Fictional demo price (KRW)").fill("55000");
    await page.getByRole("button", {name: "Save service"}).click();
    await expect(page.getByText("The service was created.")).toBeVisible();
    await expect(page.getByRole("heading", {name: serviceName})).toBeVisible();

    await page.goto("/en/owner/bookings");
    await page.getByLabel("Status").selectOption("requested");
    await expect(page.locator("tbody").getByText("Requested", {exact: true}).first()).toBeVisible();
  });

  test("owner milestone pages remain responsive and localized in English", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInDemo(page, "owner");

    for (const [path, heading] of [
      ["/en/owner/dashboard", "Operations dashboard"],
      ["/en/owner/calendar", "Booking calendar"],
      ["/en/owner/services", "Services"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", {name: heading, level: 1})).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      expect(await page.locator("body").innerText()).not.toMatch(/[가-힣]/);
    }
  });

  test("customer cannot open owner pages or owner APIs", async ({page}) => {
    await signIn(page, customerEmail);
    await page.goto("/en/owner/dashboard");
    await expect(
      page.getByText("Sign in with an owner account to view the dashboard."),
    ).toBeVisible();
    const apiStatus = await page.evaluate(async (baseURL) => {
      const response = await fetch(
        `${baseURL}/api/v1/organizations/demo-services/owner/dashboard`,
        {credentials: "include"},
      );
      return response.status;
    }, apiBaseURL);
    expect(apiStatus).toBe(403);
  });
});
