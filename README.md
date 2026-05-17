# T-Video Media Demo

A complete educational replica of a "video reward" platform, built as a
school project about online scam awareness.

> **Educational demo for scam-awareness research. No real money, no real
> accounts, no real rewards.**
>
> This site is **not** affiliated with any real company or brand. The name
> "T-Video Media Demo" is fictional and is used purely to study the design
> patterns commonly seen on fake reward / task platforms. There is no real
> backend, no real authentication, no real payment processing, and no real
> wallet addresses.

## What is included

A 16-page responsive UI that mirrors the typical structure of a
reward-task scam platform, plus a dedicated **Scam Analysis** page that
explains every pattern the demo intentionally reproduces.

| Page | File | Purpose |
|---|---|---|
| Landing | `index.html` | Marketing-style intro, feature cards, red-flag list |
| Login | `login.html` | Fake login (any input redirects to dashboard) |
| Register | `register.html` | Fake registration with invitation-code warning |
| Dashboard | `dashboard.html` | Profile, fake balance, stats, quick actions |
| Video Tasks | `tasks.html` | Fake "watch to earn" cards with countdown modal |
| VIP Levels | `vip.html` | 6 fake VIP tiers with upgrade warning modal |
| Recharge | `recharge.html` | Fake deposit form (no real payment processing) |
| Withdraw | `withdraw.html` | Fake withdrawal form, history with all status types |
| Invite | `invite.html` | Fake invite code/link, L1/L2/L3 commission cards |
| Team | `team.html` | Fake downline statistics and table |
| Transactions | `transactions.html` | Tabbed history of fake records |
| Messages | `messages.html` | Fake announcements illustrating urgency tactics |
| Support | `support.html` | Auto-reply demo chat, FAQ, demo ticket form |
| Scam Analysis | `scam-analysis.html` | Educational walkthrough of every red flag |
| Settings | `settings.html` | Local-only preferences and reset |
| Admin Demo | `admin.html` | Fake operator dashboard for educational analysis |

## File structure

```
.
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── tasks.html
├── vip.html
├── recharge.html
├── withdraw.html
├── invite.html
├── team.html
├── transactions.html
├── messages.html
├── support.html
├── scam-analysis.html
├── settings.html
├── admin.html
└── assets/
    ├── css/
    │   └── styles.css      # full dark theme, components
    └── js/
        ├── data.js         # all FAKE demo data (user, tasks, VIP, ...)
        └── app.js          # sidebar/topbar shell, modal, toast helpers
```

## Running locally

This is plain HTML / CSS / JavaScript. There is **no build step** and **no
backend**.

Just open `index.html` in any modern browser, or serve the folder
statically:

```bash
# Python 3
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Live demo logic

Earnings, packages, and tasks are now fully reactive instead of being
hard-coded. The site keeps its state in `localStorage` under the key
`tvmd_state` and exposes a tiny "domain" API on `window.DEMO.api`.

### Buying a package (VIP page)

1. Go to **VIP Levels**.
2. Pick any tier (VIP 0 - VIP 5) and click **Buy package (Demo)**.
3. The educational warning still fires; clicking **Activate package**
   sets `state.packageLevel` and writes a `VIP Upgrade` transaction.
4. The dashboard, tasks page, and VIP page all live-update.

If you have **no** package selected, the dashboard shows a red CTA
("You have no package selected. Buy a package to start unlocking daily
video tasks.") and the Video Tasks page shows a locked card with a
**Buy a package** button.

### Daily video tasks

The Video Tasks page generates exactly `vip.daily` task slots based on
your active package, and each task pays
`vip.dailyIncome / vip.daily` so completing all of them yields the
daily-income figure shown on the VIP card. Tasks reset every calendar
day.

| Package | Daily tasks | Per-task reward | Daily income |
|---------|-------------|-----------------|--------------|
| VIP 0   | 3           | $0.50           | $1.50        |
| VIP 1   | 6           | $0.67           | $4.00        |
| VIP 2   | 10          | $1.20           | $12.00       |
| VIP 3   | 15          | $2.33           | $35.00       |
| VIP 4   | 25          | $3.80           | $95.00       |
| VIP 5   | 40          | $7.00           | $280.00      |

### Real video playback

Drop video files into `assets/videos/` named `task-1.mp4`, `task-2.mp4`,
... up to `task-40.mp4` (the maximum at VIP 5). The player will load
the matching file for each slot. If a file is missing the player falls
back to a 5-second countdown so the task can still be completed for
demo purposes. See `assets/videos/README.md` for details.

### Withdrawing

The Withdraw page reads the real demo balance and refuses requests
larger than what the user has earned. Submitting deducts the amount and
inserts a `Pending` row into both the withdrawal history and the
transaction history. The dashboard's "Withdrawal status" card mirrors
the latest record.

### Resetting

Settings → **Reset demo data** clears `tvmd_state` and reloads the page.

## Why this exists

Real reward-task scams reuse the same UI building blocks: VIP tiers, fake
balances, task lists, multi-level referrals, and "pending" withdrawals.
By recreating the visual language of these platforms - with educational
notes attached to each section - this project gives readers a guided tour
of every red flag, so they can recognise the pattern in the wild.

See `scam-analysis.html` for the full educational walkthrough.

## What this project does **not** include

- No real authentication.
- No real backend, database, or analytics.
- No real payment processing.
- No real cryptocurrency wallets, addresses, or QR codes.
- No real bank or card collection.
- No real referral tracking.
- No real branding, logos, or claim of partnership with any company.
