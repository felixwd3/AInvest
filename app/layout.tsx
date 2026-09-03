import './globals.css'

export const metadata = {
  title: 'AINVEST',
  description: 'Din Personlige AI Aktierådgiver',
  manifest: '/manifest.json',
  themeColor: '#070b14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#070b14" />
      </head>
      <body className="bg-[#070b14] text-white">
        {children}

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registreret med succes: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registrering fejlede: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}