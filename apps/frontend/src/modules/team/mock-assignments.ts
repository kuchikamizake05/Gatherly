import { FIX } from "@/modules/_mock/fixtures";
import { readMock } from "@/modules/_mock/store";
import type { CommitteeAssignment } from "@/modules/organizer-events/types";

export function mockEventIds() {
  return Array.from(
    new Set([
      ...FIX.orgEvents.map((event) => event.id),
      ...readMock<string[]>("eventIds", []),
    ]),
  );
}
export function mockAssignments(eventId: string): CommitteeAssignment[] {
  const initial =
    eventId === FIX.festival.id
      ? FIX.team.slice(0, 2)
      : eventId === "ev_keroncong"
        ? FIX.team.slice(0, 1)
        : [];
  return readMock(
    `committee.${eventId}`,
    initial.map((member) => ({
      userId: member.id,
      name: member.name,
      username: member.username,
      assignedAt: "2026-11-12T03:02:00Z",
    })),
  );
}
