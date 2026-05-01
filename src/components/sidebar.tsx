'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Mail, FileText,
  Key, Settings, BarChart2, Target, Zap, LogOut, Link2
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/outreach', label: 'Outreach', icon: Mail },
  { href: '/linkedin-drafts', label: 'LinkedIn Drafts', icon: Link2 },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/api-keys', label: 'API Keys', icon: Key },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-card h-screen sticky top-0 flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <div className="bg-primary rounded-md p-1">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight">OutreachEngine</h1>
          <p className="text-xs text-muted-foreground">UGC Platform</p>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
