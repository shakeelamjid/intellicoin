import './globals.css'

export const metadata = {
  title: 'IntelliCoin',
  description: 'Professional crypto futures signal intelligence',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
