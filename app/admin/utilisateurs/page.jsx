'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, with_selection, without_selection
  const [selectedUser, setSelectedUser] = useState(null) // Pour le modal

  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role !== 'admin') {
        router.push('/')
        return
      }
      fetchUsers()
    }
  }, [status, session, router])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setStats(data.stats)
      } else {
        toast.error('Erreur lors du chargement')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = filterStatus === 'all' ||
                         (filterStatus === 'with_selection' && user.has_selection) ||
                         (filterStatus === 'without_selection' && !user.has_selection)

    return matchesSearch && matchesFilter
  })

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Gestion des utilisateurs</h1>
        <p className="text-gray-600 text-sm">
          Vue d'ensemble de tous les utilisateurs et leurs sélections
        </p>
      </div>

      {/* Navigation admin - Mobile optimisé */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => router.push('/admin')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm"
        >
          Catalogue
        </button>
        <button
          onClick={() => router.push('/admin/plats-personnalises')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm"
        >
          Plats perso
        </button>
        <button
          onClick={() => router.push('/admin/utilisateurs')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold text-sm"
        >
          Utilisateurs
        </button>
        <button
          onClick={() => router.push('/admin/parametres')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm"
        >
          Paramètres
        </button>
      </div>

      {/* Stats - Grid mobile-friendly */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary-500">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Total utilisateurs</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-success-500">
            <div className="text-2xl md:text-3xl font-bold text-success-600">{stats.with_selection}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Ont choisi</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-danger-500">
            <div className="text-2xl md:text-3xl font-bold text-danger-600">{stats.without_selection}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">En attente</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-secondary-500">
            <div className="text-2xl md:text-3xl font-bold text-secondary-600">{stats.with_settings}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Configurés</div>
          </div>
        </div>
      )}

      {/* Recherche et filtres - Mobile optimisé */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Rechercher un utilisateur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-base mb-3"
        />

        {/* Filtres en chips */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filterStatus === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterStatus('with_selection')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filterStatus === 'with_selection'
                ? 'bg-success-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Ont choisi
          </button>
          <button
            onClick={() => setFilterStatus('without_selection')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filterStatus === 'without_selection'
                ? 'bg-danger-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⏳ En attente
          </button>
        </div>
      </div>

      {/* Liste des utilisateurs en cards - Mobile-first */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition"
            >
              {/* Header de la card avec statut */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-gray-900">{user.name}</h3>
                    {user.has_selection ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-success-100 text-success-700 border border-success-300">
                        ✅ OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-danger-100 text-danger-700 border border-danger-300">
                        ⏳ En attente
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>

              {/* Infos de passage */}
              {user.settings_completed ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">📅 Passage:</span>
                    <span className="text-gray-900">
                      {user.delivery_day} • {user.delivery_time_slot}
                    </span>
                  </div>
                  {user.has_selection && (
                    <div className="flex items-center gap-2 text-sm mt-2">
                      <span className="font-medium text-gray-700">🍽️ Plats:</span>
                      <span className="text-gray-900 font-bold">{user.dish_count} sélectionnés</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-warning-700 font-medium">
                    ⚠️ Paramètres non configurés
                  </p>
                </div>
              )}

              {/* Actions - Gros boutons tactiles */}
              <div className="flex gap-2">
                {user.has_selection && (
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="flex-1 py-3 bg-primary-50 text-primary-600 rounded-lg font-semibold hover:bg-primary-100 transition border border-primary-200 text-sm"
                  >
                    👁️ Voir les plats
                  </button>
                )}
                {!user.has_selection && user.settings_completed && (
                  <button
                    onClick={() => toast.info('Fonction à venir')}
                    className="flex-1 py-3 bg-secondary-50 text-secondary-600 rounded-lg font-semibold hover:bg-secondary-100 transition border border-secondary-200 text-sm"
                  >
                    📧 Envoyer rappel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal détails des plats */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header du modal */}
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{selectedUser.name}</h3>
                <p className="text-sm text-gray-600">{selectedUser.dish_count} plats sélectionnés</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Liste des plats */}
            <div className="p-4 space-y-2">
              {selectedUser.dishes.map((dish, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{dish.dish_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{dish.category}</p>
                  </div>
                  {dish.quantity > 1 && (
                    <span className="ml-2 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-bold">
                      ×{dish.quantity}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer du modal */}
            <div className="sticky bottom-0 bg-white border-t p-4">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
