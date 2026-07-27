const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'mid-screen-extension');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const background = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
const mainWorld = fs.readFileSync(path.join(ROOT, 'fast-open', 'main-world.js'), 'utf8');
const bridge = fs.readFileSync(path.join(ROOT, 'fast-open', 'bridge.js'), 'utf8');

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

const fastScripts = manifest.content_scripts.filter((entry) =>
  entry.js?.some((file) => file.startsWith('fast-open/'))
);
assert(fastScripts.length === 2, 'Fast open must use one MAIN and one isolated content script.');
assert(fastScripts.some((entry) => entry.world === 'MAIN'), 'MAIN-world navigation script is missing.');
assert(fastScripts.every((entry) =>
  entry.matches.every((match) => match.includes('gmgn.ai') || match.includes('x.com') || match.includes('twitter.com'))
), 'Fast-open scripts must remain restricted to GMGN and X.');
assert(fastScripts.every((entry) =>
  entry.matches.every((match) => !match.includes('<all_urls>') && !match.includes('https://*/*'))
), 'Fast-open scripts must not be injected globally.');

assert(background.includes("FAST_WARM_URLS = {"), 'Independent warm-tab URLs are missing.');
assert(background.includes("x: 'https://x.com/home'"), 'X warm shell is missing.');
assert(background.includes("gmgn: 'https://gmgn.ai/'"), 'GMGN warm shell is missing.');
assert(background.includes("/^\\/follow(?:\\/|$)/i"), 'GMGN /follow protection is missing.');
assert(
  background.indexOf('if (getFastOpenKind(url))') < background.indexOf("const mode = shouldForceNewTab(rawUrl)"),
  'Fast routing must run before the legacy GMGN new-tab rule.'
);
assert(mainWorld.includes('window.open = function fastOpenWindow'), 'GMGN window.open capture is missing.');
assert(mainWorld.includes('/\\/token\\//i'), 'Only GMGN token opens should be captured.');
assert(!mainWorld.includes('MutationObserver'), 'Fast-open bridge must not scan page mutations.');
assert(!mainWorld.includes('setInterval'), 'Fast-open bridge must not poll.');
assert(!bridge.includes('MutationObserver'), 'Isolated bridge must remain event-driven.');

console.log('mid-screen fast-open checks passed');
