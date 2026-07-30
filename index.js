const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const instagramRoutes = require("./routes/instagram");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "insta-downloader-api",
    status: "running",
    usage: "/api/instagram/download?url=https://www.instagram.com/reel/XXXXXXX/",
  });
});

app.use("/api/instagram", instagramRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: "route not found" });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`insta-downloader-api running on port ${PORT}`));
}

module.exports = app;
