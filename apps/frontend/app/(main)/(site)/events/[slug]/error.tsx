"use client";

import { EventLoadError } from "@/modules/events/components/EventDetailStates";

export default function Error({ reset }: { reset: () => void }) {
  return <EventLoadError onRetry={reset} />;
}
