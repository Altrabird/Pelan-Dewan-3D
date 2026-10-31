# Codex handoff — visual polish

Completed 31 October 2026. Local changes only; ready for Claude Code review.

## Changes

- **js/models.js:** Refined every furniture/model builder. Plastic chairs have open moulded backs; banquet chairs have cream covers, coloured sashes and rear bows; VIP chairs have cushions, feet and restrained gold trim. Plastic / banquet / VIP use **10 / 10 / 11 direct Mesh children**, respectively, with no chair textures. Added timber stage decking, a folded perimeter skirt, tread nosing, upholstered sofas, cloth tables, a wood rostrum with a procedural gold crest plate, an illustrated BM ceremony screen, procedural Jalur Gemilang (14 stripes, crescent and 14-point star), leafy potted plants, speaker cones, tripod camera details, framed double doors, pillar accents and a softer zone patch. The person now has separate limbs, shoes, hair and facial features facing -z. Shirt colour remains controlled by the argument. Timber tint still responds to the item colour. Labels use larger canvas text, a cream backing, a fine border and tone-independent sprite materials.
- **js/view3d.js:** Warm neutral background, ACES tone mapping, warmer key light, soft hemisphere and unshadowed fill light, cream-tinted matte walls and a reusable procedural timber floor. The shadow map remains 2048 square. Only the floor material expression changes inside build(); build structure and disposal are retained. chairs(), path(), placeArrows(), tick(), setPov(), frame() and png() were compared against the original and are unchanged. Public properties, labels group and coordinate conventions remain intact.
- **css/style.css:** Teal/slate controls, cream panels, restrained borders/shadows, keyboard focus rings, clearer seating total and compact responsive spacing. Existing selectors and escaped 2D/3D view switching remain intact. No HTML or application text changes.

Fixed artwork/materials are cached; reusable maps are marked for upload when accessed after the existing build disposal. Label materials/textures use a bounded 192-entry cache. No dependency, external image, network request or post-processing pass was added.

## Verification

- node tests/selftest.mjs — PASS, 298 seats.
- python tests/e2e.py against the existing localhost:8765 server — ALL OK, including interaction, undo/redo, POV playback and no console errors. Repeated after final source edits. Its normal screenshot outputs were regenerated; test source was not edited.
- Additional browser checks: all model builders return valid finite geometry; label builder returns null; stage and steps retain the requested width, depth, ground origin and exact top height (within floating-point tolerance). Chair children are plain Mesh objects and remain below 12 parts.
- Reviewed the generated 3D overview and a separate 1366 x 768 split-view capture. At 1366 x 768 the top bar is 44px high, main area is 950 x 724px and there is no horizontal page overflow; all left tools remain visible.
- Initial PowerShell exec helper failed to start. Node filesystem access and child_process.execFile successfully ran edits and both requested commands. The server was already available; no new server was left running.

## Limitations and deliberate omissions

- No integrated-GPU hardware benchmark or extended memory soak was performed. Browser checks use Playwright Chromium with software rendering. Geometry, instancing and shadow constraints are respected, but target-laptop frame rate needs hardware review.
- The gold crest is a stylised SK Bandar Tawau shield, not a claim to reproduce the school's official emblem; no official artwork was supplied.
- No label decluttering or camera reframing: those would change behaviour. Dense stage/path labels can still overlap in overview, as before.
- Omitted hanging decorations, roof structure, fabric simulation, high-poly chair stitching, reflections and post-processing to preserve clarity and laptop performance.
- The worktree already contained staged project files. No staged content was reset or committed. The authored diff is limited to the three permitted source files and this requested handoff.
