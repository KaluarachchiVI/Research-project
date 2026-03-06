/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  // Explicitly set Turbopack root to fix workspace detection issue
  // This prevents Next.js from detecting the wrong root due to multiple lockfiles
  turbopack: {
    root: path.join(__dirname),
  },
}

module.exports = nextConfig
