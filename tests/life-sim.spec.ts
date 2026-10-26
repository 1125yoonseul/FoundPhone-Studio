import { test, expect, type Page } from "@playwright/test";

async function unlock(page: Page) {
  await page.getByRole("button", { name: "轻触解锁" }).click();
  for (const digit of ["1", "1", "2", "5"])
    await page.getByRole("button", { name: `密码键${digit}` }).click();
  await expect(page.locator(".lock-screen")).toHaveCount(0);
}

test("action menu enters a scene, returns to phone and restores the save", async ({
  page,
}) => {
  await page.goto("/");
  await unlock(page);
  await page.getByRole("button", { name: "今天做什么" }).click();
  await expect(page.getByRole("button", { name: /去找将太郎/ })).toBeVisible();
  await page.getByRole("button", { name: /去找将太郎/ }).click();
  await expect(page.getByRole("region", { name: "线下剧情" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "江边见面" })).toBeVisible();
  await page.getByRole("button", { name: "走过去，拿走他手里的饮料" }).click();
  await page.getByRole("button", { name: "今晚先到这里" }).click();
  await expect(page.getByRole("region", { name: "线下剧情" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "今天做什么" })).toContainText(
    "汉江公园江边",
  );

  await page.reload();
  await unlock(page);
  await expect(page.getByRole("button", { name: "今天做什么" })).toContainText(
    "23:32",
  );
  await page.getByRole("button", { name: "打开KakaoTalk" }).click();
  await page.getByRole("button", { name: /哥哥/ }).first().click();
  await expect(page.getByText("到家告诉我。今晚的事不急。")).toBeVisible();
});

test("ignoring the message still allows sleeping into the next day", async ({
  page,
}) => {
  await page.goto("/");
  await unlock(page);
  await page.getByRole("button", { name: "今天做什么" }).click();
  await page.getByRole("button", { name: /回家/ }).click();
  await page.getByRole("button", { name: "今天做什么" }).click();
  await page.getByRole("button", { name: /睡觉/ }).click();
  await expect(page.getByRole("button", { name: "今天做什么" })).toContainText(
    "2026-10-26",
  );
  await page.getByRole("button", { name: "今天做什么" }).click();
  await expect(
    page.getByRole("button", { name: /和有真去咖啡厅/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /去图书馆复习/ }),
  ).toBeVisible();
});
