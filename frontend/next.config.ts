import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /**
   * The e2e suite builds and serves its own copy of the app while the dev
   * container is still running from the same bind mount. Sharing one `.next`
   * means the production build wipes the dev server's chunks under it: the
   * page still renders server-side, every script 403s, React never hydrates,
   * and the whole app becomes unclickable with nothing in the terminal to say
   * so. The e2e run sets this to a directory of its own.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withNextIntl(nextConfig);
