import axios from "axios";

export default async function handler(req, res) {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "No URL provided"
      });
    }

    // Open share page
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Cookie":
          `ndus=${process.env.NDUS_COOKIE}`
      }
    });

    const html = response.data;

    // Extract jsToken
    const jsTokenMatch = html.match(/jsToken.*?%22(.*?)%22/);

    if (!jsTokenMatch) {
      return res.status(500).json({
        status: false,
        message: "jsToken not found"
      });
    }

    const jsToken = jsTokenMatch[1];

    // Extract shorturl
    const shortMatch =
      url.match(/s\/(.*?)($|\?)/);

    if (!shortMatch) {
      return res.status(500).json({
        status: false,
        message: "Invalid Terabox URL"
      });
    }

    const shorturl = shortMatch[1];

    // API request
    const apiResponse = await axios.get(
      "https://www.terabox.app/share/list",
      {
        params: {
          app_id: "250528",
          shorturl,
          root: "1",
          jsToken
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0",
          "Cookie":
            `ndus=${process.env.NDUS_COOKIE}`
        }
      }
    );

    const data = apiResponse.data;

    if (!data.list || !data.list.length) {
      return res.status(404).json({
        status: false,
        message: "No file found"
      });
    }

    const file = data.list[0];

    return res.status(200).json({
      status: true,
      file_name: file.server_filename,
      size: file.size,
      thumbnail: file.thumb,
      download_url: file.dlink,
      stream_url: file.dlink
    });

  } catch (e) {
    return res.status(500).json({
      status: false,
      error: e.message
    });
  }
}
