import { afterEach, expect, it, vi } from "vitest";
import { askLive } from "./ideas-stream";

afterEach(() => vi.restoreAllMocks());

function streamOf(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Cut mid-line on purpose: a frame is whatever the network hands over.
      controller.enqueue(bytes.slice(0, 40));
      controller.enqueue(bytes.slice(40));
      controller.close();
    },
  });
  return { ok: true, body } as unknown as Response;
}

it("hands over each started title, each finished dish, and then the answer", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    streamOf(
      "event:progress\ndata:{\"done\":1,\"of\":2,\"title\":\"Dahl\"}\n\n" +
        "event:dish\ndata:{\"index\":1,\"of\":2,\"dish\":{\"title\":\"Dahl\"}}\n\n" +
        "event:progress\ndata:{\"done\":2,\"of\":2,\"title\":\"Soupe\"}\n\n" +
        "event:result\ndata:{\"proposals\":[{\"title\":\"Dahl\"},{\"title\":\"Soupe\"}]}\n\n",
    ),
  );
  const progress: unknown[] = [];
  const dishes: unknown[] = [];
  const result = await askLive<{ proposals: unknown[] }, { title: string }>(
    "/api/plan/suggest",
    {},
    (p) => progress.push(p),
    (d) => dishes.push(d),
  );
  expect(progress).toHaveLength(2);
  expect(dishes).toEqual([{ index: 1, of: 2, dish: { title: "Dahl" } }]);
  expect(result).toEqual({ ok: true, result: { proposals: [{ title: "Dahl" }, { title: "Soupe" }] } });
});

it("reads a stream that ends without an answer as a failure, not an empty answer", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    streamOf("event:progress\ndata:{\"done\":1,\"of\":3,\"title\":\"Dahl\"}\n\nevent:failed\ndata:{}\n\n"),
  );
  const result = await askLive("/api/plan/suggest", {}, () => {});
  expect(result).toEqual({ ok: false });
});
