import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { SessionProvider } from '@/components/layout/session-provider'
import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { ImpersonationWrapper } from '@/components/layout/impersonation-wrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch user role for impersonation context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  return (
    <SessionProvider>
      <ImpersonationWrapper currentUserId={session.user.id} currentUserRole={user?.role || null}>
        <div className="min-h-screen bg-muted/30">
          <Sidebar />
          <div className="md:ms-64">
            <Navbar />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ImpersonationWrapper>
    </SessionProvider>
  )
}
