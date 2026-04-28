# Kill Yr Substack

A browser extension that redirects Substack articles to an archiving service of your choice. Works on `*.substack.com` as well as custom domains.

[Why does this exist?](https://jasoncosper.com/kill-yr-substack/)

## How It Works

Three tiers. Each one more ruthless than the last…

### Tier 1: Known Substack domains

All `*.substack.com/p/*` article URLs and `substack.com/@*` profile URLs get intercepted at the network level via `declarativeNetRequest`. The HTTP request never fires. The page never loads. Done.

### Tier 2: Learned custom domains

Once the extension flags a custom domain as a Substack site (see Tier 3), it caches the domain name and adds a `declarativeNetRequest` rule. Every future visit to that domain gets the same network-level block as Tier 1. No traffic to Substack.

### Tier 3: First-visit detection

The first time you hit a Substack with a custom domain, the page has to load so the content script can sniff for platform fingerprints:

1. `<meta name="generator" content="Substack">` tag
2. Stylesheets or assets from `substackcdn.com`
3. Scripts from `substack.com` or `substackcdn.com`
4. Substack's React `AppFrame` component
5. RSS feed links pointing to `substack.com`
6. Substack-specific class names paired with subscribe forms

Hit any of those and the page redirects to `archive.is`. The domain gets cached and promoted to Tier 2 for next time.

The popup gives you a toggle to pause/resume redirects and a list of learned custom domains. You can remove individual domains if something gets flagged incorrectly.

## Picking Your Archive Service

Kill Yr Substack 1.2.x adds a preference for where its redirects land. `archive.is` (the default) or Ghost Archive. To switch, head to the options page (`chrome://extensions` on Chromium, `about:addons` on Firefox), find Kill Yr Substack, and open preferences.

Why offer the choice? Some folks have an understandable issue with `archive.is` after [the maintainer DDoSed a blog that was investigating the site's ownership](https://arstechnica.com/tech-policy/2026/02/wikipedia-might-blacklist-archive-today-after-site-maintainer-ddosed-a-blog/). Their behavior is nasty and I don't agree with it.

`archive.is` stays the default tho. It's the most seamless link-to-archived-page experience I've come across. Just one click. And if the page has never been captured before the site grabs it on the spot.

Ghost Archive gets close. It searches for the URL first, and if nothing's been archived it shows an "Archive it now?" button. One extra click, but you still (eventually) get to where you were trying to go.

Pick whichever option makes you feel less gross.

## Install

Pre-built packages are available in the [`dist/`](dist/) directory and as [GitHub Releases](https://github.com/anticapitalistcomputerclub/kill-yr-substack/releases).

### Chrome / Chromium

**From CRX:**
1. Download `dist/kill-yr-substack.crx`
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Drag `kill-yr-substack.crx` onto the page

**From ZIP (unpacked):**
1. Download and extract `dist/kill-yr-substack-X.Y.Z.zip`
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the extracted folder

**From source:**
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this repository directory

### Firefox

**From XPI:**
1. Download `dist/kill-yr-substack-X.Y.Z.xpi`
2. Go to `about:addons`
3. Click the gear icon, select **Install Add-on From File...**
4. Select the downloaded XPI file

## Permissions

The extension requests `<all_urls>` because Substack sites can be assigned custom domains. The content script runs lightweight DOM queries and bails immediately on any sites that aren't Substack.

## License

MIT
