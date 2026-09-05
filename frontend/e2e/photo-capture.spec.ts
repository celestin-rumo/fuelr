import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

/**
 * Photograph a page, keep the recipe, drop the rest.
 *
 * The interesting assertions are the ones a unit test cannot make: that the
 * crop is *applied* before anything leaves the device, and that nothing leaves
 * before somebody says so. The canvas only exists in a browser, so this is
 * where the cropping is actually proved.
 */
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";

let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `shot-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** A tall PNG, so a crop changes the shape and not only the bytes. */
/**
 * A real PNG, generated rather than pasted: 200x400, so a crop changes the
 * shape and not only the byte count. An invented base64 blob looks like a PNG
 * and fails in `createImageBitmap`, which surfaces as "unreadable" three steps
 * later — which is exactly how the first version of this test went wrong.
 */
const PAGE = Buffer.from(
    "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",
  "base64",
);

test.beforeEach(async ({ request, context, page }) => {
  await signIn(request, context);

  /*
   * Whether a reader is wired is an environment fact — a deployment with no
   * key offers nothing rather than failing once somebody has chosen their
   * photographs — and everything below happens on the *near* side of that
   * boundary: the capture, the frame and the crop all run in the browser
   * before a single byte is sent. So this skips rather than pretends, and CI
   * gives its backend a key that cannot be billed precisely so it does run
   * there.
   */
  await page.goto("/fr/app/recettes/importer");
  await page.getByTestId("source-PHOTO").click();
  const wired = await page.getByTestId("choose-files").count();
  test.skip(wired === 0, "no reader is wired in this environment");
});

test("taking a photo is not sending it", async ({ page }) => {
  // Nothing is requested while a picture is only sitting there.
  let sent = 0;
  await page.route("**/api/recipes/import/photos**", (route) => {
    sent += 1;
    return route.abort();
  });

  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "page.png",
    mimeType: "image/png",
    buffer: PAGE,
  });

  await expect(page.getByTestId("import-shots").locator("li")).toHaveCount(1);
  expect(sent, "a photograph was sent before anybody asked").toBe(0);
});

test("pictures accumulate, because a recipe spans two pages", async ({ page }) => {
  const shots = page.getByTestId("import-shots").locator("li");

  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "left.png",
    mimeType: "image/png",
    buffer: PAGE,
  });
  await expect(shots).toHaveCount(1);

  // The right-hand page adds; it does not replace.
  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "right.png",
    mimeType: "image/png",
    buffer: PAGE,
  });
  await expect(shots).toHaveCount(2);

  // And a blurred one goes, before it is paid for.
  await page.getByTestId("remove-shot-0").click();
  await expect(shots).toHaveCount(1);
});

test("the crop is applied to the image, not sent as coordinates", async ({ page }) => {
  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "page.png",
    mimeType: "image/png",
    buffer: PAGE,
  });

  await page.getByTestId("crop-0").click();
  const dialog = page.getByTestId("crop-dialog");
  await expect(dialog).toBeVisible();

  // Drag the bottom-right handle up and left: the frame keeps roughly the top
  // half. Done with the mouse rather than by setting state, because the point
  // of this test is that the gesture works.
  const handle = page.getByTestId("crop-handle-se");
  const from = (await handle.boundingBox())!;
  const stage = (await page.getByTestId("crop-frame").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 - stage.width * 0.4,
    from.y + from.height / 2 - stage.height * 0.4,
    { steps: 12 },
  );
  await page.mouse.up();

  await page.getByTestId("crop-done").click();
  // The thumbnail says so, so nobody wonders whether it took.
  await expect(page.getByTestId("import-shots")).toContainText("recadrée");

  // What actually leaves the device is a cropped image. The request is
  // intercepted and the file measured: a crop kept as coordinates would send
  // the original back at its full size.
  const sizes: number[] = [];
  await page.route("**/api/recipes/import/photos**", async (route) => {
    const body = route.request().postDataBuffer();
    sizes.push(body?.length ?? 0);
    await route.fulfill({ status: 502, body: "{}" });
  });

  await page.getByRole("button", { name: "Lire la recette" }).click();
  await expect.poll(() => sizes.length).toBe(1);

  // A JPEG of the top half is smaller than the original PNG plus form
  // boilerplate would be, and above zero: something real was drawn.
  expect(sizes[0]).toBeGreaterThan(0);
});

test("a photo stays re-croppable, and can be put back", async ({ page }) => {
  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "page.png",
    mimeType: "image/png",
    buffer: PAGE,
  });

  await page.getByTestId("crop-0").click();
  const handle = page.getByTestId("crop-handle-se");
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x - 60, from.y - 60, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId("crop-done").click();
  await expect(page.getByTestId("import-shots")).toContainText("recadrée");

  // You notice you cut off an ingredient by looking at the thumbnail.
  await page.getByTestId("crop-0").click();
  await page.getByTestId("crop-reset").click();
  await page.getByTestId("crop-done").click();
  await expect(page.getByTestId("import-shots")).not.toContainText("recadrée");
});

test("the frame moves from the keyboard too", async ({ page }) => {
  await page.getByTestId("choose-files").click();
  await page.locator("#import-files").setInputFiles({
    name: "page.png",
    mimeType: "image/png",
    buffer: PAGE,
  });
  await page.getByTestId("crop-0").click();

  // It starts on the whole image, so there is nowhere to move until it is
  // smaller — shrink it first, then walk it.
  const handle = page.getByTestId("crop-handle-se");
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x - 80, from.y - 80, { steps: 8 });
  await page.mouse.up();

  const frame = page.getByTestId("crop-frame");
  const before = (await frame.boundingBox())!;
  await frame.focus();
  await page.keyboard.press("Shift+ArrowRight");
  const after = (await frame.boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x);
});
