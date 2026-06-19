# Team TimeFlow — Audit Report

**Date:** June 12, 2026
**Scope:** Full codebase + live database scan
**Reviewer:** Claude (Cowork)

This is everything I found that could cause inaccurate payroll, lose data,
expose your business, or just make life harder than it needs to be. Sorted
by severity. Each item has: what it is, where it lives, the impact, and a
suggested fix.

---

## 🔴 Critical — fix before next payroll

### C1. PTO/sick/holiday hours are counted toward overtime

**Where:** `src/components/admin/AdminPayroll.tsx` lines ~22–30, also dashboard OT-risk calc
**What:** `calculatePayroll()` sums every entry regardless of `entryType`.
A 40-hour vacation week plus one 8-hour work day would show as 8 OT hours —
but vacation isn't worked time, so it shouldn't push past the OT threshold.
**Impact:** Anyone with PTO/sick days near their 40-hour line is being
overpaid OT. Compounds the longer someone is out.
**Fix:** Separate `regular hours` (entry_type='work') from `paid leave hours`
(everything else). Only `work` hours count toward the 40-hour OT threshold.
Show paid leave as a separate column in payroll exports.

---

### C2. The kiosk doesn't prevent double clock-ins

**Where:** `src/pages/KioskPage.tsx` line 66, `handleClockIn`
**What:** `handleClockIn` always calls `createTimeEntry()` — no check for
an existing open shift. If an employee scans in twice (or scans in without
realizing they already clocked in), you get two open entries.
**Impact:** This is the root cause of the 15 forgotten clock-outs we just
cleaned up. It will happen again.
**Fix:** Before creating, query for an open entry for that employee. If
one exists, refuse and show "You're already clocked in (since X). Tap Clock
Out instead, or call a manager."

---

### C3. No "old open shift" detection when scanning PIN

**Where:** `src/pages/KioskPage.tsx`
**What:** When Kayla scanned her PIN Saturday morning with a leftover open
shift from Friday evening, the kiosk happily closed that shift at "now"
(Saturday 8:44 AM), creating the 12.67-hour phantom we deleted. There's
no warning that the open shift is suspiciously old.
**Impact:** Even with the prevention in C2, anyone with a forgotten
shift gets a wrong clock-out time the next time they scan in.
**Fix:** On PIN success, check for an open shift > 12 hours old. If found,
show a "Did you forget to clock out yesterday? When did you actually
leave?" screen before showing the normal Clock In/Out options.

---

### C4. `entry_date` is stored in UTC, not Chicago time

**Where:** `src/lib/db.ts` `createTimeEntry`, `createManualTimeEntry`,
and the `entry_date` update inside `updateTimeEntry`
**What:** All three use `new Date().toISOString().split('T')[0]` which
gives you the UTC date. A clock-in at 7:30 PM Chicago time (00:30 UTC the
next day) gets `entry_date` = TOMORROW.
**Impact:** Evening shifts get filed under the wrong day. This was a
contributing factor to Kayla's phantom — her Friday-evening clock-in had
`entry_date = Saturday` because of UTC, so the Saturday kiosk view saw it
as "today's" open shift.
**Fix:** Compute the date in `America/Chicago` timezone using
`Intl.DateTimeFormat('en-CA', { timeZone: company.timezone })` or a
matching helper. Also affects: pay period boundaries, the date picker we
just built.

---

### C5. Joey Templet — salary employee with hourly_rate leftover

**Where:** Database row
**What:** Joey is `pay_type='salary'` but has `hourly_rate` set. Same
leftover-field pattern as Kayla's $1 salary that you just cleared.
**Impact:** Doesn't directly affect his pay (the calc respects pay_type)
but inflates `OT Risk` if any logic reads the wrong column.
**Fix:** Clear his `hourly_rate`. Plus a code fix in `EmployeeDialog`:
when switching pay type, also clear the other field.

---

### C6. Open break left on a closed shift

**Where:** Database
**What:** 1 break row where `end_time IS NULL` but the parent
time_entry's `clock_out IS NOT NULL`. The break math falls back to
`Date.now()` for its end time, so the shift's break duration is shown
as huge.
**Impact:** That shift's "worked hours" calculation is wrong — break
time is overstated, so worked time is understated.
**Fix:** I'll patch this row directly. Find/end the dangling break.

---

### C7. 7 ultra-short shifts (under 5 minutes)

**Where:** Database
**What:** 7 time entries with clock_in/clock_out less than 5 minutes
apart. Almost certainly accidental clock-ins or test entries.
**Impact:** Tiny but they clutter reports and could be confusing.
**Fix:** Review and delete. I can pull the list for you to look at.

---

## 🟠 High — security; address soon

### S1. PINs are stored plaintext in the database

**Where:** `employees.pin` column, used directly in `KioskPinEntry.tsx`
**What:** Every employee's PIN is plain text. Anyone who can read the
database (including from the browser via the public anon key — see S4)
can see them.
**Impact:** Leaked PINs let someone clock other employees in/out,
falsifying timesheets and payroll.
**Fix:** Hash PINs with bcrypt (Postgres has `pgcrypto`). Move PIN
verification to a Supabase Edge Function so the hash never leaves the
server. Bigger lift but the right end state.

---

### S2. Admin passwords are baked into the browser bundle

**Where:** `useAdminAuth.ts` reads `VITE_OWNER_PASSWORD` and
`VITE_ADMIN_PASSWORD` from env vars
**What:** Anything `VITE_`-prefixed gets compiled into the JS bundle
shipped to the browser. Anyone can View Source / network tab in
DevTools and read the passwords.
**Impact:** Owner-tier access is effectively public if anyone visits
your site and looks. Pay rates and payroll are then exposed.
**Fix:** Replace with real Supabase Auth (email/password or magic link)
for admin accounts. Keep the kiosk PIN flow separate.

---

### S3. Kiosk allows unlimited PIN attempts

**Where:** `src/components/kiosk/KioskPinEntry.tsx`
**What:** No rate limiting or lockout. After a wrong PIN the dots reset
and you try again immediately. 4 digits = 10,000 possibilities,
brute-forceable in well under an hour.
**Impact:** Anyone with physical access to the kiosk (customers,
delivery drivers) can guess an employee's PIN.
**Fix:** After 5 wrong attempts, lock that employee's PIN entry for
60 seconds. Track attempts client-side OR (better) server-side via a
new `pin_attempts` table.

---

### S4. Row Level Security is fully open

**Where:** Every table — `pg_policies` shows `qual = "true"` everywhere
**What:** Every table has policies like `FOR SELECT TO public USING (true)`.
Combined with the anon key being public (it's in your client bundle),
**anyone on the internet can read or modify your entire database** by
inspecting your site and using the anon key from a script.
**Impact:** Worst-case anyone could exfiltrate all employee PINs and pay
rates, or delete your time history.
**Fix:** Real Supabase Auth (see S2) → restrict tables to authenticated
users → restrict employees to seeing only their own rows → restrict
admins via JWT claims. Big lift but unavoidable if this app is on the
public internet.

---

### S5. Admin auth can be bypassed from browser DevTools

**Where:** `src/hooks/useAdminAuth.ts`
**What:** Auth state is stored in `localStorage` under
`team-timeflow.admin-auth` as the literal string `"owner"` or `"manager"`.
Anyone on the admin login page can open DevTools → Application → Local
Storage → set the key to `"owner"` → refresh → in.
**Impact:** Effectively no admin protection.
**Fix:** Same as S2 — Supabase Auth issues a real JWT that can't be forged.

---

## 🟡 Medium — accuracy & robustness

### M1. `expected_return` used as fallback for missing `end_time` on breaks

**Where:** `AdminTimeTracking.tsx`, `AdminPayroll.tsx` — the break-time
reducers
**What:** `b.endTime ? endTime : b.expectedReturn ? expectedReturn : Date.now()`.
`expected_return` is just the kiosk's GUESS at when the break will end
(set at break start). Using it as actual end time is wrong.
**Impact:** Slightly inaccurate break math if an employee returns later
than expected and the break wasn't manually ended.
**Fix:** Drop the `expected_return` fallback. Use `Date.now()` for active
breaks, full stop. `expected_return` is for display only ("expected back
at 12:45").

---

### M2. Hard delete of an employee wipes their time history

**Where:** `AdminEmployees.tsx` → `deleteEmployee()`
**What:** Deleting an employee cascades to wipe every `time_entry` and
`break` they ever had (depending on FK ON DELETE setting, may also throw
an error). The warning text mentions this but it's easy to click through.
**Impact:** Payroll history vanishes. If audited later, you can't prove
what they were paid.
**Fix:** Either soft-delete (set `is_active = false`, hide from kiosk)
or refuse deletion when time entries exist. The "Active" checkbox is
already the right pattern — disable the trash icon entirely.

---

### M3. 19 hourly employees have no pay rate set

**Where:** Database
**What:** Two-thirds of your active hourly staff have `hourly_rate` =
NULL or 0. Payroll Export already shows them as "rate not set" but they
contribute 0 to gross pay calculations.
**Impact:** Real-pay totals on the dashboard are massively understated
until rates are entered.
**Fix:** Owner-tier task — go through Employees and set everyone's rate.
I can generate a checklist if helpful.

---

### M4. Future clock-out times are allowed

**Where:** `TimeEntryDialog.tsx` — validation
**What:** The form rejects `clock_out < clock_in` but not
`clock_out > now()`. You could accidentally type `Jun 15` instead of
`Jun 5` and save a future clock-out.
**Impact:** Inflates worked hours.
**Fix:** Reject `clock_out > now` with the message "Clock-out can't be
in the future."

---

### M5. No audit log viewer in the UI

**Where:** Missing component
**What:** We write to `audit_log` on every edit/delete (15 entries
already from the bulk fix), but admins can't see it in the app.
**Impact:** Compliance gap. If someone asks "who edited Avery's punch
last week?" you'd have to query Supabase directly.
**Fix:** Add an "Audit Log" admin view (owner-only) that lists recent
entries. Plus a "History" button on each time entry row that shows
that record's audit trail.

---

### M6. No way to bulk-edit forgotten punches in the UI

**Where:** `AdminForgottenPunches.tsx`
**What:** The new view fixes them one at a time. Bulk-fix (apply median
shift length to all selected) requires going to Supabase like we just
did.
**Impact:** Tedious during cleanup.
**Fix:** Add a "Estimate & set clock-out" button per row that uses the
employee's median shift length. Plus a "Estimate all" toolbar action.

---

### M7. Multiple components fetch today's entries independently

**Where:** `AdminAttendance.tsx`, `AdminDashboardOverview.tsx`,
`KioskPage.tsx`, `AdminTimeTracking.tsx` all call `useTimeEntries()`
independently
**What:** Each component fires its own Supabase query for the same
data. No coalescing.
**Impact:** Minor — Supabase handles it fine — but eats some bandwidth
and adds latency on slow connections.
**Fix:** Use React Query (`@tanstack/react-query` is already installed)
with a shared cache key.

---

### M8. `getEmployeeStatus` doesn't filter by date

**Where:** `src/data/mockData.ts` `getEmployeeStatus()`
**What:** Returns "clocked-in" if ANY open entry exists, regardless of
how old it is. The kiosk staff board would show someone as clocked-in
if they have a 3-day-old forgotten shift in today's fetch.
**Impact:** Currently masked because `useTimeEntries()` only loads
today's entries — but if that ever expands, the bug surfaces.
**Fix:** Require the open entry to be from today.

---

### M9. Switching pay type doesn't clear the other field

**Where:** `EmployeeDialog.tsx`
**What:** When an admin switches an employee from hourly → salary, the
old `hourly_rate` stays in the DB (and vice versa). This is how Kayla
ended up with $1 salary as an hourly employee, and how Joey ended up
with an hourly_rate as a salary employee.
**Impact:** Confusing reports; would cause real pay errors if any code
ever reads the wrong column.
**Fix:** In `onSubmit`, explicitly set the OTHER field to null when pay
type changes.

---

### M10. AdminPayroll OT calc treats currently-open shifts as "growing"

**Where:** `AdminPayroll.tsx` `calculatePayroll()` uses `Date.now()` for
missing clock-outs
**What:** If you open the Payroll Export page while someone is on the
clock today, their hours are growing in real-time and you might see a
different OT number a minute later.
**Impact:** Confusing for the owner running payroll mid-day.
**Fix:** For closed periods, treat null clock-outs as 0 hours and flag
them. For the current period, keep current behavior but show a "live"
indicator.

---

## 🟢 Low — polish

### L1. Mock data still bundled into production

**Where:** `src/data/mockData.ts` — 6 fake employees, 4 fake time entries,
3 fake announcements
**What:** Used as fallback when Supabase isn't configured. Adds ~5KB to
the bundle and is dead code in production.
**Fix:** Move mock data to a test-only file, or delete entirely once
Supabase is the only source.

---

### L2. No real "forgot password" flow

**Where:** `AdminLoginScreen.tsx`
**What:** Says "Ask the owner or store manager." No way to recover.
**Fix:** Tied to S2 — once real auth lands, send a magic link.

---

### L3. Big files getting larger

**Where:** `src/lib/db.ts` is now over 1000 lines
**What:** Single file holds employees, time entries, breaks, audit log,
pay periods, announcements, attendance, company settings.
**Fix:** Split into `db/employees.ts`, `db/timeEntries.ts`, etc. Pure
cosmetic, but easier to navigate.

---

### L4. Idle timeout in kiosk is fixed at 30 seconds

**Where:** `KioskPage.tsx` line 26: `const IDLE_TIMEOUT = 30000;`
**What:** Not configurable. May be too short for some employees.
**Fix:** Make it a company_settings field.

---

### L5. No dark mode toggle

**Where:** `CompanyThemeProvider.tsx` reads colors from
company_settings, but no light/dark mode switch
**What:** The app theme is whatever the OS prefers (`next-themes` is
installed but I don't see it wired in).
**Fix:** Add a toggle in AdminSidebar or AdminCompanySettings.

---

## Triage suggestion

If I had to pick the order:

1. **C2** (prevent double clock-ins) — stops the problem from recurring
2. **C3** (warn on old open shifts) — protects against any double-ins that slip through
3. **C1** (PTO vs OT math) — fixes payroll accuracy
4. **C4** (timezone bug) — fixes date-boundary issues forever
5. **C6 + C7** (clean up bad rows) — one-time data cleanup, fast
6. **M2** (no hard delete) — prevents catastrophic data loss
7. **S1–S5** (real auth) — security overhaul, biggest lift, do once everything else is stable

I can take any of these on next. C1, C2, C3, C4 are the ones that will
make the biggest difference for accuracy. C6 and C7 I can fix right now
via Supabase MCP if you want.
