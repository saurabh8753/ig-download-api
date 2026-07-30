const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

const IG_URL_REGEX = /instagram\.com\/(p|reel|tv|reels)\/[A-Za-z0-9_-]+/i;

// =========================================================================
// METHOD 1 (fast path): direct POST + manual decode.
// Works only when Cloudflare does NOT challenge the request.
// =========================================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://snapsave.app",
  Referer: "https://snapsave.app/download-instagram",
};

function baseConvert(str, fromBase, toBase) {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("");
  const fromAlphabet = alphabet.slice(0, fromBase);
  const toAlphabet = alphabet.slice(0, toBase);

  let num = str
    .split("")
    .reverse()
    .reduce((acc, char, idx) => {
      const digit = fromAlphabet.indexOf(char);
      return digit !== -1 ? acc + digit * Math.pow(fromBase, idx) : acc;
    }, 0);

  let result = "";
  while (num > 0) {
    result = toAlphabet[num % toBase] + result;
    num = Math.floor(num / toBase);
  }
  return result || "0";
}

function extractEncodedArgs(raw) {
  const marker = "decodeURIComponent(escape(r))}(";
  const startIdx = raw.indexOf(marker);
  if (startIdx === -1) return null;

  const afterMarker = raw.slice(startIdx + marker.length);
  const endIdx = afterMarker.indexOf("))");
  if (endIdx === -1) return null;

  const argsStr = afterMarker.slice(0, endIdx);
  return argsStr.split(",").map((v) => v.replace(/^\s*"|"\s*$/g, "").trim());
}

function decodeSnapSaveResponse(raw) {
  const args = extractEncodedArgs(raw);
  if (!args || args.length < 4) {
    throw new Error("could not locate encoded payload (likely Cloudflare challenge page)");
  }

  const [h, uStr, nStr, tStr] = args;
  const u = parseInt(uStr, 10);
  const n = parseInt(nStr, 10);
  const t = parseInt(tStr, 10);

  if (Number.isNaN(u) || Number.isNaN(n) || Number.isNaN(t) || t <= 0) {
    throw new Error("bad decode args (likely Cloudflare challenge page, not real response)");
  }

  let decoded = "";
  for (let i = 0; i < h.length; i += t) {
    const chunk = h.substr(i, t);
    const value = parseInt(baseConvert(chunk, u, 10), 10) - n;
    decoded += String.fromCharCode(value);
  }

  return decodeURIComponent(escape(decoded));
}

function extractDownloadHtml(decoded) {
  const startMarker = 'getElementById("download-section").innerHTML = "';
  const startIdx = decoded.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("download-section marker not found in decoded payload");
  }

  const afterStart = decoded.slice(startIdx + startMarker.length);
  const endMarker = '"; document.getElementById("inputData").remove(); ';
  const endIdx = afterStart.indexOf(endMarker);
  const rawHtml = endIdx !== -1 ? afterStart.slice(0, endIdx) : afterStart;

  return rawHtml
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "")
    .replace(/\\/g, "");
}

function parseMediaFromHtml(html) {
  const $ = cheerio.load(html);
  const media = [];
  const seen = new Set();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !href.startsWith("http") || seen.has(href)) return;

    const text = $(el).text().toLowerCase();
    const isVideo = /\.mp4|video/i.test(href) || text.includes("video");
    seen.add(href);

    media.push({ type: isVideo ? "video" : "image", url: href, quality: text.trim() || null });
  });

  if (media.length === 0) {
    $("video source, video").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http") && !seen.has(src)) {
        seen.add(src);
        media.push({ type: "video", url: src, quality: null });
      }
    });
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http") && !seen.has(src)) {
        seen.add(src);
        media.push({ type: "image", url: src, quality: null });
      }
    });
  }

  const description =
    $("span.video-des").text().trim() || $(".content p").first().text().trim() || null;

  return { description, media };
}

async function fetchViaDirectRequest(url) {
  const form = new FormData();
  form.append("url", url);

  const res = await axios.post("https://snapsave.app/action.php?lang=en", form, {
    headers: { ...HEADERS, ...form.getHeaders() },
    timeout: 15000,
  });

  const decoded = decodeSnapSaveResponse(res.data);
  const html = extractDownloadHtml(decoded);
  return parseMediaFromHtml(html);
}

// =========================================================================
// METHOD 2 (fallback): real headless browser.
// Lets an actual Chromium instance load the page, pass any Cloudflare
// JS-challenge naturally (since it behaves like a real browser), submit
// the form, and read the rendered #download-section directly from the DOM.
// Will NOT reliably pass an interactive captcha/Turnstile challenge —
// only automatic "checking your browser" style JS challenges.
// =========================================================================

async function fetchViaHeadlessBrowser(url) {
  const chromium = require("@sparticuz/chromium");
  const puppeteer = require("puppeteer-core");

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    );

    await page.goto("https://snapsave.app/download-instagram", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the actual input form to appear — this naturally waits out
    // a "checking your browser" style Cloudflare JS challenge, if present.
    await page.waitForSelector('input[name="url"]', { timeout: 20000 });

    await page.type('input[name="url"]', url, { delay: 20 });

    await Promise.all([
      page.click('button[type="submit"], form button'),
      page
        .waitForFunction(
          () => {
            const el = document.getElementById("download-section");
            return el && el.innerHTML.trim().length > 0;
          },
          { timeout: 25000 }
        )
        .catch(() => null),
    ]);

    const html = await page.evaluate(() => {
      const el = document.getElementById("download-section");
      return el ? el.innerHTML : "";
    });

    if (!html) {
      throw new Error(
        "download-section stayed empty — page may still be behind an interactive Cloudflare challenge/captcha"
      );
    }

    return parseMediaFromHtml(html);
  } finally {
    if (browser) await browser.close();
  }
}

// ---------- Main entry point ----------

async function fetchInstagramMedia(url) {
  if (!url || typeof url !== "string") {
    return { success: false, error: "A valid Instagram url string is required" };
  }

  if (!IG_URL_REGEX.test(url)) {
    return { success: false, error: "URL does not look like an Instagram post/reel/tv link" };
  }

  const errors = [];
  let result;

  // Try the cheap, fast method first.
  try {
    result = await fetchViaDirectRequest(url);
  } catch (e) {
    errors.push(`direct_request: ${e.message}`);
  }

  // Fall back to a real browser if the fast path failed or found nothing.
  if (!result || !result.media?.length) {
    try {
      result = await fetchViaHeadlessBrowser(url);
    } catch (e) {
      errors.push(`headless_browser: ${e.message}`);
    }
  }

  if (!result || !result.media?.length) {
    return {
      success: false,
      error: "No downloadable media found",
      detail: errors,
    };
  }

  return {
    success: true,
    url,
    description: result.description,
    count: result.media.length,
    media: result.media,
  };
}

module.exports = { fetchInstagramMedia };
