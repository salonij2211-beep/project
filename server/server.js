const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const transactionRoutes = require("./routes/transactionRoutes");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/transactions", transactionRoutes);

console.log("URI:", process.env.MONGO_URI);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Expense Tracker API Running...");
});