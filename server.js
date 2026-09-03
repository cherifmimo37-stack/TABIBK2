const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        app: "TABIBK",
        message: "سيرفر طبيبك يعمل بنجاح 🩺"
    });
});

app.listen(PORT, () => {
    console.log(`TABIBK Server running on port ${PORT}`);
});
