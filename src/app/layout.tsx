import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Amilou - Suivi Coran',
  description: 'Application de suivi des cours de Coran',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
