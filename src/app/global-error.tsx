"use client";

import ReleaseFallback from "@/components/ReleaseFallback";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <head><title>Nexus Setups</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body><ReleaseFallback title="Something went wrong" message="We could not load Nexus Setups. Try again or return to the homepage." onRetry={reset} /></body>
    </html>
  );
}
