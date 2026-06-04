/** @type {import('next').NextConfig} */
const bikeFitReportPublicAssets = [
  "./public/echeloncycling_full_logo.jpg",
  "./public/Saddle-height.png",
  "./public/Saddle-setback.png",
  "./public/Handlebar-reach-and-drop.png",
  "./public/Grip-reach-and-drop.png",
  "./public/Handlebar-width.png",
];

const nextConfig = {
  experimental: {
    // @react-pdf/renderer ships native/wasm deps (yoga) that must not be
    // bundled by webpack; keep it external so it runs in the Node server-action runtime.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // Static literals in public-assets.ts are not enough: without this, public/
    // files are omitted from the Vercel lambda (verified via .nft.json trace).
    outputFileTracingIncludes: {
      "/bike-fits/[id]": bikeFitReportPublicAssets,
    },
  },
};

module.exports = nextConfig;
