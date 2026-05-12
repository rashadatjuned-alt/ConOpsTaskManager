import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    // 'smart' placement allows Cloudflare to decide where to run code for best speed
    placement: "smart",
  },
};

export default config;
