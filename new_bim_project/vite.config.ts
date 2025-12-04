import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig({
  server: {
    host: true,
    https: {
      key: fs.readFileSync("./cert/key.pem"),
      cert: fs.readFileSync("./cert/cert.pem")
    }
  },
  optimizeDeps: {
    exclude: ["web-ifc"]
  }
});
