# Product

## Register

product

## Users

- **Inspector** — registers/searches vehicles and runs fitness checklists in the field, often outdoors on a phone with poor or no connectivity. Needs the app usable offline and legible in daylight glare.
- **Hub supervisor** — reviews exceptions, voids incorrect inspections, manages local operations for one hub.
- **District administrator** — manages users and hubs within a district; approves defined overrides; views district reports.
- **Central administrator** — manages zones, fee schedules, templates, provider configuration nationally; provisions users; renews/revokes certificates.
- **Finance operator** — reconciles payments, reviews failed/reversed transactions, watches provider settlement exceptions.
- **Traffic police verifier** — scans a certificate QR roadside, online or fully offline, to confirm validity in seconds. No editing rights, minimal data shown.
- **Owner/public** — views a certificate's limited public status through a short link or QR scan. No account.

All are working *for* the authority, not shopping or browsing — every screen sits inside a procedure with a correct outcome, not a discretionary journey.

## Product Purpose

A government platform (piloting at BUET/Polytechnic hubs, Bangladesh) that certifies e-rickshaw roadworthiness end to end: inspection → fee billing → mobile-financial-service payment → signed certificate/QR issuance → roadside verification, with full audit trail, geographic access control, and revocation/renewal. Success is measured in digitized inspection records, exactly-once payment-to-certificate linkage, roadside scans that resolve in under 3 seconds online / 1 second offline, and zero unauthorized cross-zone access.

## Brand Personality

**Official & authoritative.** The interface should read the way a passport office or vehicle-registration counter reads: procedure-first, plainly labelled, unmistakably legitimate — never a startup or consumer product. Design language in the spirit of GOV.UK / Estonia's e-services: plain, accessible, high information density handled cleanly rather than decorated away.

Bangladesh flag green (`#006a4e`, already committed in the existing CSS) is the anchor brand color and stays the singular authority marker — not diluted by a wider decorative palette.

## Anti-references

Not a consumer SaaS dashboard: no gradient hero sections, no marketing-style empty-state illustrations, no playful micro-copy, no glassmorphism, no card-grid-of-features treatment. Nothing that would make an inspector or a traffic officer wonder whether they're using an official tool or someone's side project. Trust is earned through restraint and clarity, not through visual flourish.

## Design Principles

1. **Procedure over decoration** — every screen is a step in an official process, not a surface to be sold on. Hierarchy comes from information structure, not ornament.
2. **Legible under duress** — inspectors work outdoors on low-end Android devices with patchy signal and direct sunlight; verifiers work roadside, sometimes one-handed. High contrast, large touch targets, no functionality that depends on hover.
3. **Bangla-first, English-supported** — Bangla is the primary language, not a translated afterthought; layout must hold up in both scripts without reflow breakage or clipped text.
4. **One truth per screen** — status (paid/unpaid, valid/revoked/expired, in-zone/out-of-zone) must be instantly and unambiguously legible. A misread state here is a real-world compliance or fraud outcome, not a UX inconvenience.
5. **Trust through restraint** — a single institutional color (flag green) carries authority; the platform earns credibility by looking exactly as serious as its subject matter.

## Accessibility & Inclusion

Target: WCAG 2.1 AA. A first pass exists (aria-live status regions, focus-visible outlines, skip-to-content link, aria-current nav) but has not been through a certified audit — expect follow-up work here. Bangla/English toggle is implemented and must stay in sync with `<html lang>`. Must remain fully operable by keyboard (traffic-police field use may involve gloves or low dexterity) and respect `prefers-reduced-motion`.
