# Kill Yr Substack

A browser extension that redirects Substack articles to `archive.is`. Works on `*.substack.com` as well as custom domains.

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

## Install

### Chrome / Chromium

**From CRX:**
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Drag `kill-yr-substack.crx` onto the page

**From ZIP (unpacked):**
1. Extract `kill-yr-substack-X.Y.Z.zip`
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the extracted folder

### Firefox

1. Go to `about:addons`
2. Click the gear icon, select **Install Add-on From File...**
3. Select `kill-yr-substack-X.Y.Z.xpi`

## Permissions

The extension requests `<all_urls>` because Substack sites can be assigned custom domains. The content script runs lightweight DOM queries and bails immediately on any sites that aren't Substack.

## License

MIT
