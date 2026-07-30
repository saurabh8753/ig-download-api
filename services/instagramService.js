const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://snapsave.app",
  Referer: "https://snapsave.app/download-instagram",
};

const IG_URL_REGEX = /instagram\.com\/(p|reel|tv|reels)\/[A-Za-z0-9_-]+/i;

// ---------- Decoding snapsave.app's obfuscated response ----------

// Converts a numeric string between two custom alphabets (base "fromBase" -> base "toBase")
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

// Pulls the [h, u, n, t, e, r] arguments out of the eval(...) wrapper
// without ever executing the remote script.
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
    throw new Error("could not locate encoded payload in response");
  }

  const [h, uStr, nStr, tStr] = args;
  const u = parseInt(uStr, 10);
  const n = parseInt(nStr, 10);
  const t = parseInt(tStr, 10);

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
    throw new Error("download-section not found in decoded payload");
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

// ---------- Parsing the final HTML for media links ----------

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

    media.push({
      type: isVideo ? "video" : "image",
      url: href,
      quality: text.trim() || null,
    });
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
    $("span.video-des").text().trim() ||
    $(".content p").first().text().trim() ||
    null;

  return { description, media };
}

// ---------- Main entry point ----------

async function fetchInstagramMedia(url) {
  if (!url || typeof url !== "string") {
    return { success: false, error: "A valid Instagram url string is required" };
  }

  if (!IG_URL_REGEX.test(url)) {
    return {
      success: false,
      error: "URL does not look like an Instagram post/reel/tv link",
    };
  }

  try {
    const form = new FormData();
    form.append("url", url);

    const res = await axios.post(
      "https://snapsave.app/action.php?lang=en",
      form,
      {
        headers: { ...HEADERS, ...form.getHeaders() },
        timeout: 15000,
      }
    );

    const decoded = decodeSnapSaveResponse(res.data);
    const html = extractDownloadHtml(decoded);
    const { description, media } = parseMediaFromHtml(html);

    if (!media.length) {
      return {
        success: false,
        error:
          "No downloadable media found — post may be private, removed, or unsupported",
      };
    }

    return { success: true, url, description, count: media.length, media };
  } catch (err) {
    return {
      success: false,
      error: "Error fetching media: " + (err?.message || String(err)),
    };
  }
}

module.exports = { fetchInstagramMedia };
