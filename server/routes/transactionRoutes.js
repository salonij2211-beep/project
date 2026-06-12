const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

// GET all transactions
router.get("/", async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ADD transaction
router.post("/", async (req, res) => {
  console.log("BODY:", req.body);

  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    console.log("ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
});
// DELETE transaction
router.delete("/:id", async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: "Transaction deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE transaction
router.put("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;