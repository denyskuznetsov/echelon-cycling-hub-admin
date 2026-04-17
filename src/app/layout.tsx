import "./globals.css"
import type { Metadata } from "next"
import { UserProvider } from "@/src/context/UserContext"

export const metadata: Metadata = {
  title: "Echelon Cycling Hub Admin",
  description: "Echelon Cycling Hub Admin",
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

      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  )
}
