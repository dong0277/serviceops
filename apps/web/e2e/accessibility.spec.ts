import AxeBuilder from "@axe-core/playwright";
import {expect, test, type Page} from "@playwright/test";

async function signInDemo(page: Page, role: "customer" | "owner" | "staff") {
  await page.goto("/en/login");
  await page.getByRole("button", {name: `Fill ${role} account`}).click();
  await page.locator("form button[type='submit']").click();
  await expect(page.getByText("You are signed in.")).toBeVisible();
}

async function expectNoAccessibilityViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const {violations} = await new AxeBuilder({page})
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({html: node.html, target: node.target})),
    })),
    `${label} has automated accessibility violations`,
  ).toEqual([]);
}

async function expectMinimumTouchTargets(page: Page, label: string) {
  const undersizedTargets = await page
    .locator(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="radio"]',
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            element: element.tagName.toLowerCase(),
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ??
              element.getAttribute("name") ??
              "",
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              style.pointerEvents !== "none",
          };
        })
        .filter(({visible, width, height}) => visible && (width < 24 || height < 24)),
    );

  expect(undersizedTargets, `${label} has touch targets smaller than 24 CSS pixels`).toEqual([]);
}

test.describe("ServiceOps accessibility", () => {
  test("public, login, and customer booking surfaces meet automated WCAG checks", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", {level: 1})).toBeVisible();
    const skipLink = page.getByRole("link", {name: "Skip to main content"});
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expectNoAccessibilityViolations(page, "public preview");

    await page.goto("/en/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expectNoAccessibilityViolations(page, "login");

    await signInDemo(page, "customer");
    await page.goto("/en/booking");
    await expect(page.getByRole("heading", {name: "How can we help?"})).toBeVisible();
    await expectNoAccessibilityViolations(page, "customer booking");
  });

  test("staff surface meets automated WCAG checks", async ({page}) => {
    await signInDemo(page, "staff");
    await page.goto("/en/staff/bookings");
    await expect(page.getByRole("heading", {name: "My assigned work"})).toBeVisible();
    await expectNoAccessibilityViolations(page, "staff bookings");
  });

  test("owner surfaces and dialogs meet automated WCAG checks", async ({page}) => {
    await signInDemo(page, "owner");
    for (const [path, heading] of [
      ["dashboard", "Operations dashboard"],
      ["bookings", "Booking management"],
      ["calendar", "Booking calendar"],
      ["customers", "Customers"],
      ["services", "Services"],
      ["team", "Team"],
      ["audit", "Audit log"],
    ] as const) {
      await page.goto(`/en/owner/${path}`);
      await expect(page.getByRole("heading", {name: heading, level: 1})).toBeVisible();
      await expectNoAccessibilityViolations(page, `owner ${path}`);
    }

    await page.goto("/en/owner/services");
    const createButton = page.getByRole("button", {name: "New service"});
    await createButton.click();
    const dialog = page.getByRole("dialog", {name: "Create service"});
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Service name")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", {name: "Close service dialog"})).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", {name: "Save service"})).toBeFocused();
    await expectNoAccessibilityViolations(page, "service dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(createButton).toBeFocused();
  });

  test("mobile navigation traps focus, closes with Escape, and restores focus", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInDemo(page, "owner");
    await page.goto("/en/owner/dashboard");
    const openButton = page.getByRole("button", {name: "Open navigation"});
    await openButton.click();
    const drawer = page.getByRole("dialog", {name: "Mobile owner navigation"});
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", {name: "Close navigation"})).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("link", {name: "Audit log"})).toBeFocused();
    await expectNoAccessibilityViolations(page, "owner mobile navigation");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test("owner pages reflow with reduced motion and forced colors", async ({page}) => {
    await page.setViewportSize({width: 640, height: 450});
    await page.emulateMedia({reducedMotion: "reduce", forcedColors: "active"});
    await signInDemo(page, "owner");

    for (const [path, heading] of [
      ["dashboard", "Operations dashboard"],
      ["calendar", "Booking calendar"],
      ["services", "Services"],
    ] as const) {
      await page.goto(`/en/owner/${path}`);
      await expect(page.getByRole("heading", {name: heading, level: 1})).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior))
        .toBe("auto");
    }
  });

  test("representative mobile pages provide minimum touch target geometry", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});

    await page.goto("/en/booking");
    await expect(page.getByRole("heading", {name: "How can we help?"})).toBeVisible();
    await expectMinimumTouchTargets(page, "customer booking");

    await page.context().clearCookies();
    await signInDemo(page, "staff");
    await page.goto("/en/staff/bookings");
    await expect(page.getByRole("heading", {name: "My assigned work"})).toBeVisible();
    await expectMinimumTouchTargets(page, "staff bookings");

    await page.context().clearCookies();
    await signInDemo(page, "owner");
    await page.goto("/en/owner/dashboard");
    await expect(page.getByRole("heading", {name: "Operations dashboard"})).toBeVisible();
    await expectMinimumTouchTargets(page, "owner dashboard");
  });
});
