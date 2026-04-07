import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Subframe Next.js Starter",
  description: "Your starter kit for integrating Subframe into Next.js",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>

      <body>{children}</body>
    </html>
  )
}
