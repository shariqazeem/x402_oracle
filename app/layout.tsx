import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'x402-oracle | Wallet Reputation Oracle',
  description: 'An x402-protected API that scores wallet history on Solana. Give AI agents the ability to assess wallet trustworthiness.',
  keywords: ['x402', 'solana', 'wallet', 'reputation', 'oracle', 'ai', 'agents', 'micropayments'],
  authors: [{ name: 'ParallaxPay' }],
  openGraph: {
    title: 'x402-oracle | Wallet Reputation Oracle',
    description: 'AI Agents blindly trust wallets. Give them eyes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'x402-oracle | Wallet Reputation Oracle',
    description: 'AI Agents blindly trust wallets. Give them eyes.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
