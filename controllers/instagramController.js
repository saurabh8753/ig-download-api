const { fetchInstagramMedia } = require("../services/instagramService");

async function handleInstagramDownload(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: "Missing 'url' query parameter." });
  }

  const result = await fetchInstagramMedia(url);

  if (!result.success) {
    return res.status(422).json(result);
  }

  res.json(result);
}

module.exports = { handleInstagramDownload };
