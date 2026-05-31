const express = require("express");
const router = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer } = require("../controllers/customerController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getCustomers);
router.get("/:id", protect, getCustomer);
router.post("/", protect, createCustomer);
router.put("/:id", protect, updateCustomer);

module.exports = router;
