import './globals.css'

export const metadata = {
  title: 'AInvest',
  description: 'Din personlige investeringsassistent',
  manifest: '/manifest.json',
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
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}