import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { logServerError } from "@/lib/server-log";

export type DeliveryEntry = { key: string; name: string };

export function createDeliveryZip(
  entries: DeliveryEntry[],
  open: (key: string, signal: AbortSignal) => Promise<Readable>,
  requestSignal: AbortSignal,
) {
  const archive = new ZipArchive({ zlib: { level: 0 } });
  const output = new PassThrough({ highWaterMark: 64 * 1024 });
  const controller = new AbortController();
  let active: Readable | undefined;
  let stopped = false;
  let started = false;

  function stop(error?: unknown) {
    if (stopped) return;
    stopped = true;
    controller.abort();
    active?.destroy();
    archive.abort();
    archive.destroy();
    output.destroy(error ? new Error("Delivery stream failed.") : undefined);
    requestSignal.removeEventListener("abort", onAbort);
  }
  function fail(error: unknown) {
    if (!stopped) logServerError("Delivery ZIP stream failed", error);
    stop(error);
  }
  function onAbort() { stop(new Error("Delivery cancelled.")); }

  output.on("error", () => {});
  output.on("close", () => {
    if (!output.readableEnded) stop();
    requestSignal.removeEventListener("abort", onAbort);
  });
  archive.on("error", fail);
  archive.on("warning", fail);
  archive.pipe(output);
  requestSignal.addEventListener("abort", onAbort, { once: true });
  if (requestSignal.aborted) onAbort();

  async function produce() {
    try {
      for (const entry of entries) {
        if (stopped) return;
        const source = await open(entry.key, controller.signal);
        if (stopped) { source.destroy(); return; }
        active = source;
        source.on("error", fail);
        await new Promise<void>((resolve, reject) => {
          const clean = () => {
            archive.off("entry", onEntry);
            controller.signal.removeEventListener("abort", onStopped);
          };
          const onEntry = () => { clean(); resolve(); };
          const onStopped = () => { clean(); reject(new Error("Delivery stopped.")); };
          archive.once("entry", onEntry);
          controller.signal.addEventListener("abort", onStopped, { once: true });
          try { archive.append(source, { name: entry.name }); }
          catch (error) { clean(); reject(error); }
        });
        source.destroy();
        active = undefined;
      }
      if (!stopped) await archive.finalize();
    } catch (error) {
      fail(error);
    }
  }

  return {
    stream: Readable.toWeb(output, {
      strategy: { highWaterMark: 64 * 1024, size: chunk => chunk.length },
    }) as ReadableStream<Uint8Array>,
    start() { if (!started && !stopped) { started = true; void produce(); } },
    cancel: stop,
  };
}
