import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      // /projects/<project>/<embed>.png is served by the png route handler.
      beforeFiles: [
        {
          source: "/projects/:slug/:file.png",
          destination: "/projects/:slug/png/:file.png",
        },
      ],
    }
  },
}

export default nextConfig
