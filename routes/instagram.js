const express = require("express");
const router = express.Router();
const { handleInstagramDownload } = require("../controllers/instagramController");

router.get("/download", handleInstagramDownload);

module.exports = router;
