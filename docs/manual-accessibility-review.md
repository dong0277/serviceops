# Manual accessibility review

Use this checklist after the automated accessibility suite passes and before a public deployment or MVP release tag. Test only with the fictional demo identities documented in the README.

## Review environment

Record one row for each assistive-technology combination.

| Date | Tester | Screen reader | Browser | OS or device | Locale  | Result |
| ---- | ------ | ------------- | ------- | ------------ | ------- | ------ |
|      |        | VoiceOver     | Safari  | macOS        | Korean  |        |
|      |        |               |         |              | English |        |

The first pass should use VoiceOver with Safari on macOS. The second pass must use a different screen-reader/browser combination, such as NVDA with Firefox or Chrome on Windows, or TalkBack with Chrome on Android.

## Screen-reader scenarios

Start the local stack with `make start`, open <http://localhost:3000/ko> using the default `WEB_PORT`, and use normal screen-reader navigation instead of the visual pointer whenever possible. If `WEB_PORT` is overridden in `.env`, use that port instead.

| Surface          | Actions                                                                                                                         | Expected announcement and behavior                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public preview   | Move from the skip link to the main heading, preview cards, language selector, and login link. Activate the skip link.          | The page title, heading levels, link purposes, selected language, and main landmark are clear. The skip link moves reading and keyboard focus to the main content.                                     |
| Login            | Switch between login and registration, inspect every field, submit an empty or invalid form, fill a demo identity, and sign in. | Mode state, labels, required fields, errors, busy state, and successful sign-in are announced once and in a useful order. Password contents are not spoken unexpectedly.                               |
| Customer booking | Navigate service, date, and time radio groups; review the summary; submit a booking; open the customer's booking list.          | Group labels, selected states, localized dates, staff names, price guidance, disabled/enabled submit state, confirmation, and booking status are understandable without visual context.                |
| Staff work       | Open the mobile navigation, inspect assigned work, and advance one eligible status.                                             | The dialog name, current navigation item, booking identity, status, available action, confirmation, and focus restoration are announced. Background content is not reachable while the drawer is open. |
| Owner dashboard  | Read headings, metric labels and values, today's schedule, status overview, and calendar links.                                 | Metrics remain paired with their labels, schedule rows read in a meaningful order, and repeated calendar links have understandable names.                                                              |
| Owner services   | Open and close the create-service dialog, move through every field, trigger validation, and return to the page.                 | Initial focus, dialog name, field labels, validation, Escape dismissal, and restored trigger focus are correct. Focus does not leave the open dialog.                                                  |
| Owner calendar   | Navigate the date range control, month controls, calendar or agenda entries, and any date picker.                               | Full localized dates, selected/current states, booking summaries, and month changes are announced without relying on color or grid position alone.                                                     |

Repeat the public preview, login, and one protected role flow under `/en`. Confirm that no Korean product text is announced on the English routes.

## Physical touch review

Use at least one intended phone or tablet rather than browser emulation alone.

- Confirm that the language selector, account/menu controls, preview/back links, calendar links, service/date/time choices, and primary actions can be activated reliably with one finger.
- Confirm that adjacent controls do not cause frequent accidental activation.
- Check portrait orientation at the default text size and with the device text size increased.
- Open the owner and staff drawers, scroll long booking content, and use the bottom-most actions without clipped or unreachable controls.
- Confirm that focus indicators and selected states remain visible in bright and dark viewing conditions supported by the device.

The automated suite rejects visible interactive targets smaller than 24 CSS pixels on the representative 390 × 844 customer, staff, and owner pages. This is a regression guard, not a substitute for the physical-device review above.

## Findings log

| ID  | Environment | Route and control | Severity | Observed result | Expected result | Resolution | Retest |
| --- | ----------- | ----------------- | -------- | --------------- | --------------- | ---------- | ------ |
|     |             |                   |          |                 |                 |            |        |

Treat a blocked task, missing name or state, incorrect reading order, focus loss, or inaccessible required action as release-blocking. Record cosmetic verbosity or minor duplicate announcements separately, then retest every fixed finding with the same environment before marking the review complete.
