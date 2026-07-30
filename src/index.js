// Instagram Story + Post/Reel Download API
// Routes:
//   GET /story?username=someuser
//   GET /post?url=https://www.instagram.com/p/XXXXXXX/

const IG_APP_ID = "936619743392459";
const UA_WEB =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const UA_APP =
  "Instagram 309.0.0.34.109 Android (33/13; 480dpi; 1080x2137; samsung; SM-G990E; o1s; exynos2100; en_US; 543397730)";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/story") {
        return await handleStory(url, env);
      }
      if (url.pathname === "/post") {
        return await handlePost(url, env);
      }
      return jsonResponse({ error: "unknown route. use /story or /post" }, 404);
    } catch (err) {
      return jsonResponse({ error: "internal error", detail: String(err) }, 500);
    }
  },
};

// ---------- STORY ----------

async function handleStory(url, env) {
  const username = url.searchParams.get("username");
  if (!username) return jsonResponse({ error: "username query param required" }, 400);

  const cookie = env.IG_SESSION_COOKIE;
  if (!cookie) return jsonResponse({ error: "IG_SESSION_COOKIE not configured" }, 500);

  const userId = await getUserId(username, cookie);
  if (!userId) return jsonResponse({ error: "user not found or private/blocked" }, 404);

  const stories = await getStories(userId, cookie);
  return jsonResponse(stories, 200);
}

async function getUserId(username, cookie) {
  const res = await fetch(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { headers: { "User-Agent": UA_WEB, "x-ig-app-id": IG_APP_ID, Cookie: cookie } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.user?.id ?? null;
}

async function getStories(userId, cookie) {
  const res = await fetch(`https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`, {
    headers: { "User-Agent": UA_APP, Cookie: cookie, "x-ig-app-id": IG_APP_ID },
  });
  if (!res.ok) throw new Error(`IG responded with ${res.status}`);

  const data = await res.json();
  const reel = data?.reels?.[userId];
  if (!reel || !reel.items?.length) return { user_id: userId, count: 0, stories: [] };

  const stories = reel.items.map((item) => {
    const isVideo = Array.isArray(item.video_versions) && item.video_versions.length > 0;
    return {
      id: item.id,
      type: isVideo ? "video" : "image",
      media_url: isVideo ? item.video_versions[0]?.url : item.image_versions2?.candidates?.[0]?.url,
      thumbnail_url: item.image_versions2?.candidates?.[0]?.url ?? null,
      taken_at: item.taken_at,
      expiring_at: item.expiring_at,
    };
  });

  return { user_id: userId, count: stories.length, stories };
}

// ---------- POST / REEL ----------

async function handlePost(url, env) {
  const postUrl = url.searchParams.get("url");
  if (!postUrl) return jsonResponse({ error: "url query param required" }, 400);

  const shortcode = extractShortcode(postUrl);
  if (!shortcode) return jsonResponse({ error: "invalid instagram url" }, 400);

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/post/${shortcode}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let result;
  const cookie = env.IG_SESSION_COOKIE;

  if (cookie) {
    // Prefer session-based (handles carousels + private, if account has access)
    try {
      const mediaId = shortcodeToMediaId(shortcode);
      result = await getMediaInfo(mediaId, cookie);
    } catch (e) {
      result = await scrapeEmbed(shortcode); // fallback
    }
  } else {
    result = await scrapeEmbed(shortcode);
  }

  const response = jsonResponse(result, 200);
  response.headers.set("Cache-Control", "public, max-age=300");
  await cache.put(cacheKey, response.clone());
  return response;
}

function extractShortcode(url) {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function shortcodeToMediaId(shortcode) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let mediaId = 0n;
  for (const char of shortcode) {
    mediaId = mediaId * 64n + BigInt(alphabet.indexOf(char));
  }
  return mediaId.toString();
}

async function getMediaInfo(mediaId, cookie) {
  const res = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
    headers: { "User-Agent": UA_WEB, "x-ig-app-id": IG_APP_ID, Cookie: cookie },
  });
  if (!res.ok) throw new Error(`IG responded with ${res.status}`);

  const data = await res.json();
  const item = data?.items?.[0];
  if (!item) throw new Error("media not found");

  return formatItem(item);
}

function formatItem(item) {
  if (item.media_type === 8 && Array.isArray(item.carousel_media)) {
    return {
      id: item.id,
      type: "carousel",
      caption: item.caption?.text ?? null,
      count: item.carousel_media.length,
      items: item.carousel_media.map(formatSingle),
    };
  }
  return { id: item.id, caption: item.caption?.text ?? null, ...formatSingle(item) };
}

function formatSingle(item) {
  const isVideo = item.media_type === 2;
  return {
    type: isVideo ? "video" : "image",
    media_url: isVideo ? item.video_versions?.[0]?.url : item.image_versions2?.candidates?.[0]?.url,
    thumbnail_url: item.image_versions2?.candidates?.[0]?.url ?? null,
    width: item.original_width ?? null,
    height: item.original_height ?? null,
  };
}

async function scrapeEmbed(shortcode) {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  const res = await fetch(embedUrl, {
    headers: { "User-Agent": UA_WEB, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`instagram embed responded with ${res.status}`);

  const html = await res.text();
  const videoUrl = extractMeta(html, "og:video");
  const imageUrl = extractMeta(html, "og:image");
  const title = extractMeta(html, "og:title");
  const description = extractMeta(html, "og:description");

  if (!videoUrl && !imageUrl) throw new Error("media not found or private/removed");

  return {
    shortcode,
    type: videoUrl ? "video" : "image",
    media_url: videoUrl || imageUrl,
    thumbnail_url: imageUrl || null,
    title: title || null,
    caption: description || null,
  };
}

function extractMeta(html, property) {
  const regex = new RegExp(`<meta property="${property}" content="([^"]+)"`, "i");
  const match = html.match(regex);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ---------- SHARED ----------

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
