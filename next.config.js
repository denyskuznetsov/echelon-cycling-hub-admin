/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer ships native/wasm deps (yoga) that must not be
    // bundled by webpack; keep it external so it runs in the Node server-action runtime.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
}

module.exports = nextConfig
