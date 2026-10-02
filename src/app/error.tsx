"use client";

import ReleaseFallback from "@/components/ReleaseFallback";

export default function ApplicationError({ reset }: { reset: () => void }) {
  return <ReleaseFallback title="Something went wrong" message="We could not load this page. Try again or return to Nexus Setups." onRetry={reset} />;
}
