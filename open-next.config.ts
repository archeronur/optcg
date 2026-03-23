import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext varsayılan olarak `npm run build` çalıştırır; `build` script'i de
// `opennextjs-cloudflare build` olduğu için döngü oluşmaması için doğrudan Next çağrılır.
export default {
  ...defineCloudflareConfig(),
  buildCommand: "npx next build",
};
