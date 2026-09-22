# Gatherly — Linear workflow

Status: proposed setup; no workspace or issues have been created in Linear by this change.

## Structure

| Object | Proposed value |
| --- | --- |
| Workspace | Gatherly, or the team's existing workspace |
| Team | Gatherly |
| Issue identifier | GAT |
| Project | Gatherly MVP — Community Event Ticketing |
| Members | Four members of Tim 11; assignments to be agreed later |

Keep frontend and backend in one team; use labels to distinguish work. Linear owns task status; GitHub owns code and pull-request review. Avoid manually duplicating the backlog into GitHub Issues.

Project description:

> Build Gatherly for US3: organizers publish events with ticket quotas; participants reserve and purchase tickets through sandbox payments; committee members validate QR tickets. Confirmed stack: Next.js, ExpressJS, MongoDB. Completion requires the full user journey, concurrency and authorization checks, documentation, and a demo matching the MVP requirements.

## Workflow

Backlog → Todo → In Progress → In Review → Done. Add Canceled as a canceled-category status. Map the other states to Linear's backlog, unstarted, started, and completed categories appropriately.

Area labels: frontend, backend, fullstack, infrastructure, documentation.
Type labels: feature, bug, test.

- One accountable owner per issue, assigned after team discussion.
- Aim for one principal in-progress issue per member.
- Todo means acceptance criteria and dependencies are clear.
- In Review means the deliverable is ready for another member to inspect.
- Done means acceptance criteria passed, relevant checks passed, PR reviewed and merged, and affected documentation updated. Documentation tasks can finish after review without application tests.
- Use blocked-by relationships and a short explanation for blocked work.
- Record PR links and meaningful verification evidence; commit count alone does not measure contribution.
- Begin with Kanban and weekly review. Optional one-week cycles can follow once capacity and schedules are agreed. Milestones represent outcomes; cycles represent time periods.

## Milestones

1. M1 Foundations: scope, data/API design, runnable apps, authentication.
2. M2 Event publishing: organizer publishes and participants discover events.
3. M3 Purchase and tickets: reservations, sandbox payment, QR tickets.
4. M4 Check-in: committee assignment and safe admission.
5. M5 Submission: hardening, deployment demo, documentation, presentation.

## Issue template

```markdown
## Outcome
What the user can accomplish.

## Scope
Work included in this issue.

## Acceptance criteria
- [ ] Observable normal behavior.
- [ ] Relevant failure or unauthorized-access behavior.

## Dependencies
Links to prerequisite issues.

## Evidence
PR, checks, or demonstration.
```

## GitHub integration

Connect `kuchikamizake05/Gatherly` from Linear's GitHub integration settings using an account with the necessary repository permissions. Select only the required repository. Verify supported account/repository access during setup.

Use actual Linear issue IDs in branch names and link PRs using the integration. Example format only: `gat-12-event-crud`; this is not an existing issue.

Suggested automation: PR ready for review → In Review; merge to main → Done. Do not mark work done on draft/open PR creation. For issues spanning several PRs, only the final qualifying merge should complete the issue.

## Setup order

1. Create or select workspace, team, project; invite the four members.
2. Configure statuses, labels, milestones, and repository/spec links.
3. Copy work items from `linear-backlog.md`; B01 etc. are local references, not Linear IDs.
4. Map dependencies to the generated Linear IDs. Leave owners and deadlines unset until agreed.
5. Start B01, then B02, before implementation decisions that depend on them.

Official references, checked 21 September 2026:
- https://linear.app/docs/projects
- https://linear.app/docs/project-milestones
- https://linear.app/docs/use-cycles
- https://linear.app/docs/github-integration
- https://linear.app/pricing
Gunakan [pembagian FE–BE](team-workflow.md) untuk ownership. Dokumen teknis tersedia pada [indeks dokumen](README.md).
