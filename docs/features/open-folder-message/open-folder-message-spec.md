## Feature goal
When a folder can't be opened, say why in plain words, once.

## Problem (reproduced 2026-11-05)
Clicking **Open folder** (Applications) or **Show in folder** (Handoff) on a sample job showed "Couldn't open the folder. Couldn't open the folder: Failed to open path". Sample jobs point at folders that were never created; the backend passed macOS's unhelpful answer through, and the UI's prefix repeated the backend's.

## Acceptance criteria
- [x] AC-1: A job whose folder isn't on disk gets "This job's folder isn't on disk yet. Applio creates it when it saves the application.", and the OS isn't asked.
- [x] AC-2: An output folder that no longer exists gets "<folder> no longer exists. Choose the folder again above.", and the OS isn't asked.
- [x] AC-3: Other OS failures pass on what the system said, without repeating the UI's "Couldn't open the folder" prefix.

## Must not break
- MNB-1: An existing folder still opens, with `~` expanded.
- MNB-2: A job with no folder still says "This job has no folder yet".

## Known risks
- The check and the open aren't atomic: a folder deleted in between falls through to AC-3's message. That's acceptable.

## Test plan
- AC-1, MNB-2: `backend.test.ts` › "says plainly when a job's folder isn't on disk, without asking the OS"
- AC-2: `backend.test.ts` › "says plainly when the output folder isn't on disk"
- AC-3, MNB-1: `backend.test.ts` › "opens a job's folder with the home directory expanded, and passes on what the OS says when it can't"

## Out of scope
- Creating application folders (draft generation, SPEC F8). Re-linking moved folders by job ID (SPEC F8).
