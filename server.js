import express from "express";
import "dotenv/config";
import userRoutes from "./routes/user.js";
import farmerRoutes from "./routes/farmer.js";
import collectorRoutes from "./routes/collector.js";

const app = express();
app.use(express.json());

app.use("/api", userRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/collector", collectorRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
