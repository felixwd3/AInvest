import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AInvest',
  description: 'Din personlige investeringsassistent og beslutningsstøtte',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AInvest',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da">
      <body className="bg-[#070b14] text-white antialiased">{children}</body>
    </html>
  )
}