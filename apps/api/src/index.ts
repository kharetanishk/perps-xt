import "dotenv/config";
import app from "./app";
import { config } from "./config/envConfig";

app.listen(config.PORT, () => {
  console.log(`listening on port ${config.PORT}`);
});
