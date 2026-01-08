import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SessionProvider } from '@/components/layout/session-provider'
import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <SessionProvider>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <div className="md:ms-64">
          <Navbar />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  )
}
