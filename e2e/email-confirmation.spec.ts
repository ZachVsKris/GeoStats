import { expect, test } from "@playwright/test";

test("email link waits for a person and keeps its token out of requests", async ({ page }) => {
  const token = "a".repeat(64);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/auth/email");
  await page.goto(`/auth/email#token_hash=${token}&type=email&redirect_to=https://geostats.xyz/auth/callback?next=%2Fdaily`);
  const button = page.getByRole("button", { name: "Confirm and sign in" });
  await expect(button).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/email$/);
  expect(requests.every(url => !url.includes(token))).toBe(true);
  expect(requests.some(url => url.includes('/auth/email/verify') || url.includes('/api/analytics/events'))).toBe(false);
  let posted = "";
  await page.route("**/auth/email/verify", async route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["origin"]).toBe(new URL(route.request().url()).origin);
    posted = route.request().postData() || "";
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Confirmation received</h1>" });
  });
  await button.click();
  await expect(page.getByRole("heading", { name: "Confirmation received" })).toBeVisible();
  expect(new URLSearchParams(posted).get("token_hash")).toBe(token);
});

test("missing email credential has a usable recovery path", async ({ page, request }) => {
  await page.goto('/auth/email');
  await expect(page.getByRole('link', { name: 'Return to GeoStats' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and sign in' })).toHaveCount(0);
  const result = await request.get('/auth/email/verify');
  expect(result.status()).toBe(405);
});
