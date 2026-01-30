'use client'

import { usePathname, useRouter } from 'next/navigation'

const adminTabs = [
  { path: '/admin', label: 'Catalogue' },
  { path: '/admin/ingredients', label: 'Ingrédients' },
  { path: '/admin/recap', label: 'Récap' },
  { path: '/admin/plats-personnalises', label: 'Plats perso' },
  { path: '/admin/utilisateurs', label: 'Utilisateurs' },
  { path: '/admin/popup', label: 'Popup' },
  { path: '/admin/parametres', label: 'Paramètres' },
  { path: '/admin/test', label: 'Test' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path) => {
    if (path === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="mb-6 flex gap-2 flex-wrap">
      {adminTabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => router.push(tab.path)}
          className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
            isActive(tab.path)
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
