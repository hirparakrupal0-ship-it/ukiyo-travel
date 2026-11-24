const express = require("express");
const { publicCatalog } = require("../controllers/catalogController");
const router = express.Router();
router.get("/", publicCatalog); // public — what the website renders
module.exports = router;
