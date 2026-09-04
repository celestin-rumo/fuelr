import { test, expect } from "@playwright/test";
import type { APIRequestContext, BrowserContext } from "@playwright/test";
import { deflateSync } from "node:zlib";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:8090";
let token = "";

async function signIn(request: APIRequestContext, context: BrowserContext) {
  const email = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}@fuelr.app`;
  const response = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email, name: "Chef", password: "motdepasse123" },
  });
  token = (await response.json()).token;
  await context.addCookies([
    { name: "fuelr_token", value: token, url: "http://localhost:3000" },
  ]);
}

/** A real PNG, built in the page so no fixture file is needed. */
async function pickImage(
  page: import("@playwright/test").Page,
  name = "photo.png",
  type = "image/png",
) {
  // A genuine 16x16 PNG. An earlier hand-written base64 string had a bad IDAT
  // checksum: the browser refused to decode it and the test blamed the code.
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM48tGUJMQwqmFUw/DVAAAOEeoQT3hKcQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: type,
    buffer,
  });
}

/** A valid PNG of flat colour, `size` pixels square. */
function bigPng(size: number) {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: size * 3 }, (_, i) => (i * 37) % 256)),
  ]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buffer: Buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

test.beforeEach(async ({ request, context }) => {
  await signIn(request, context);
});

test("a recipe has no photo to begin with, and stays valid", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await expect(page.getByTestId("recipe-photo-placeholder")).toBeVisible();
  await expect(page.getByTestId("recipe-photo")).toHaveCount(0);
  // A recipe without a photo is complete as soon as the rest is filled in.
  await expect(page.getByTestId("missing-hint")).not.toContainText("photo");
});

test("the accepted formats and size are said before anything is picked", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  const constraints = page.getByText(/JPEG, PNG ou WebP/);
  await expect(constraints).toBeVisible();
  await expect(constraints).toContainText("12 Mo maximum");
  await expect(page.getByRole("button", { name: "Ajouter une photo" })).toBeVisible();
});

test("a photo can be added, replaced and removed", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await pickImage(page);
  await expect(page.getByTestId("recipe-photo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remplacer" })).toBeVisible();

  await pickImage(page, "autre.jpg", "image/jpeg");
  await expect(page.getByTestId("recipe-photo")).toBeVisible();

  await page.getByRole("button", { name: "Supprimer la photo" }).click();
  await expect(page.getByTestId("recipe-photo-placeholder")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter une photo" })).toBeVisible();
});

test("an unsupported format is refused on the device, before any upload", async ({ page }) => {
  await page.goto("/fr/app/recettes/nouvelle");

  await page.setInputFiles('input[type="file"]', {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("pas une image"),
  });

  await expect(page.getByTestId("photo-error")).toContainText("Format non accepté");
  await expect(page.getByTestId("recipe-photo")).toHaveCount(0);
});

test("the original file is never what gets uploaded", async ({ page, request }) => {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();

  await page.goto(`/fr/app/recettes/${id}`);

  // A deliberately oversized PNG: 2000px of flat colour.
  const big = bigPng(2000);
  await page.setInputFiles('input[type="file"]', {
    name: "source.png",
    mimeType: "image/png",
    buffer: big,
  });
  await expect(page.getByTestId("recipe-photo")).toBeVisible();

  // What the server actually holds is the proof: a JPEG, not the PNG that was
  // picked, and far smaller than what came off the device.
  const stored = await request.get(`${BACKEND}/api/recipes/${id}/photo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // A PNG went in and a JPEG came out, so the picked file was not forwarded.
  expect(stored.headers()["content-type"]).toContain("image/jpeg");

  // And it was actually scaled down: 2000px in, capped at 1600 out.
  // Byte size would be a poor proxy — a flat synthetic PNG compresses far
  // better than a photographic JPEG, so the "smaller" file can be the PNG.
  const { width, height } = jpegSize(await stored.body());
  expect(Math.max(width, height)).toBeLessThanOrEqual(1600);
  expect(Math.max(width, height)).toBeGreaterThan(0);
});

/** Reads the dimensions out of a JPEG's start-of-frame marker. */
function jpegSize(buffer: Buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    // SOF0, SOF1, SOF2: the frame header carries the dimensions.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(i + 5),
        width: buffer.readUInt16BE(i + 7),
      };
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return { width: 0, height: 0 };
}

test("the photo is on the recipe, and the library stays a list", async ({
  page,
  request,
}) => {
  const created = await request.post(`${BACKEND}/api/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { id } = await created.json();
  await request.put(`${BACKEND}/api/recipes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Avec photo",
      servings: 4,
      ingredients: [{ name: "riz", quantity: 100, unit: "g" }],
      steps: ["Cuire."],
    },
  });

  await page.goto(`/fr/app/recettes/${id}`);
  await pickImage(page);
  const photo = page.getByTestId("recipe-photo");
  await expect(photo).toBeVisible();
  // Actually loaded, not a broken image standing in for the gradient.
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // The library is a list of what somebody is choosing between, and a
  // photograph there took three quarters of a row while most recipes have
  // none. It is on the recipe, where it is of something.
  await page.goto("/fr/app");
  await expect(page.getByTestId(`recipe-${id}`)).toContainText("Avec photo");
  await expect(page.getByTestId(`photo-${id}`)).toHaveCount(0);
});
