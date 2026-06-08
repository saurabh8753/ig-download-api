import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Missing Terabox URL"
      });
    }

    // Step 1: Open share page
    const page = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0",
        Cookie: `ndus=${process.env.NDUS_COOKIE}`
      }
    });

    const html = page.data;

    // Step 2: Extract JS token
    const jsTokenMatch = html.match(/%22jsToken%22%3A%22(.*?)%22/);

    const shortUrlMatch = url.match(/s\/(.*?)($|\?)/);

    if (!jsTokenMatch || !shortUrlMatch) {
      return res.status(500).json({
        status: false,
        message: "Failed to extract tokens"
      });
    }

    const jsToken = jsTokenMatch[1];
    const shorturl = shortUrlMatch[1];

    // Step 3: Call TeraBox API
    const api = await axios.get(
      "https://www.terabox.app/share/list",
      {
        params: {
          app_id: "250528",
          jsToken,
          shorturl,
          root: "1"
        },
        headers: {
          Cookie: `ndus=${process.env.NDUS_COOKIE}`,
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const data = api.data;

    if (!data.list || !data.list.length) {
      return res.status(404).json({
        status: false,
        message: "No files found"
      });
    }

    const file = data.list[0];

    return res.status(200).json({
      status: true,
      filename: file.server_filename,
      size: file.size,
      thumbnail: file.thumb || null,
      stream_url: file.dlink,
      download_url: file.dlink
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
}
