/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Proxy frontend /api/* requests to the backend to avoid CORS during local development.
    // If NEXT_PUBLIC_API_URL is provided, we use it; otherwise we assume local backend.
    const backend = (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000").replace(
      /\/$/,
      "",
    )

    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
