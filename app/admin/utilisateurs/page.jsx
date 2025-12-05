'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, with_selection, without_selection
  const [filterActive, setFilterActive] = useState('all') // all, active, inactive
  const [selectedUser, setSelectedUser] = useState(null) // Pour le modal des plats
  const [editingUser, setEditingUser] = useState(null) // Pour le modal d'édition
  const [togglingUser, setTogglingUser] = useState(null) // ID de l'utilisateur en cours de toggle
  const [savingUser, setSavingUser] = useState(false)

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

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

  // Ouvrir le modal d'édition
  const openEditModal = (user) => {
    setEditingUser({
      ...user,
      delivery_day: user.delivery_day || '',
      delivery_time_slot: user.delivery_time_slot || '',
      household_size: user.household_size || 1
    })
  }

  // Sauvegarder les modifications utilisateur
  const saveUserSettings = async () => {
    if (!editingUser) return

    setSavingUser(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          delivery_day: editingUser.delivery_day,
          delivery_time_slot: editingUser.delivery_time_slot,
          household_size: editingUser.household_size
        })
      })

      if (response.ok) {
        toast.success('Paramètres mis à jour')
        // Mettre à jour localement
        setUsers(prev => prev.map(u =>
          u.id === editingUser.id ? {
            ...u,
            delivery_day: editingUser.delivery_day,
            delivery_time_slot: editingUser.delivery_time_slot,
            household_size: editingUser.household_size,
            settings_completed: !!editingUser.delivery_day && !!editingUser.delivery_time_slot
          } : u
        ))
        setEditingUser(null)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingUser(false)
    }
  }

  // Toggle actif/inactif
  const toggleUserActive = async (userId, currentActive) => {
    setTogglingUser(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, active: !currentActive })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        // Mettre à jour localement
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, active: !currentActive } : u
        ))
        // Mettre à jour les stats
        if (stats) {
          setStats(prev => ({
            ...prev,
            active: currentActive ? prev.active - 1 : prev.active + 1,
            inactive: currentActive ? prev.inactive + 1 : prev.inactive - 1
          }))
        }
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setTogglingUser(null)
    }
  }

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = filterStatus === 'all' ||
                         (filterStatus === 'with_selection' && user.has_selection) ||
                         (filterStatus === 'without_selection' && !user.has_selection)

    const matchesActive = filterActive === 'all' ||
                         (filterActive === 'active' && user.active !== false) ||
                         (filterActive === 'inactive' && user.active === false)

    return matchesSearch && matchesFilter && matchesActive
  })

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Gestion des utilisateurs</h1>
        <p className="text-gray-600 text-sm">
          Vue d'ensemble de tous les utilisateurs et leurs sélections
        </p>
      </div>

      <AdminNav />

      {/* Stats - Grid mobile-friendly */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary-500">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.active || 0}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Clients actifs</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
            <div className="text-2xl md:text-3xl font-bold text-gray-500">{stats.inactive || 0}</div>
            <div className="text-xs md:text-sm text-gray-600 mt-1">Inactifs</div>
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

        {/* Filtres statut actif */}
        <div className="flex gap-2 flex-wrap mb-3">
          <span className="text-xs text-gray-500 self-center mr-1">Statut:</span>
          <button
            onClick={() => setFilterActive('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterActive === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterActive('active')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterActive === 'active'
                ? 'bg-success-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Actifs
          </button>
          <button
            onClick={() => setFilterActive('inactive')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterActive === 'inactive'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Inactifs
          </button>
        </div>

        {/* Filtres sélection */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center mr-1">Selection:</span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterStatus === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterStatus('with_selection')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterStatus === 'with_selection'
                ? 'bg-success-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Ont choisi
          </button>
          <button
            onClick={() => setFilterStatus('without_selection')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
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
              className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition ${
                user.active === false ? 'opacity-60 border-2 border-gray-300' : ''
              }`}
            >
              {/* Header de la card avec statut */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900">{user.name}</h3>
                    {user.active === false && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600 border border-gray-300">
                        INACTIF
                      </span>
                    )}
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
                {/* Toggle actif/inactif */}
                <button
                  onClick={() => toggleUserActive(user.id, user.active !== false)}
                  disabled={togglingUser === user.id}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    user.active !== false ? 'bg-success-500' : 'bg-gray-300'
                  } ${togglingUser === user.id ? 'opacity-50' : ''}`}
                  title={user.active !== false ? 'Cliquez pour désactiver' : 'Cliquez pour activer'}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      user.active !== false ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
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
                <button
                  onClick={() => openEditModal(user)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition border border-gray-200 text-sm"
                >
                  ⚙️ Modifier
                </button>
                {user.has_selection && (
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="flex-1 py-3 bg-primary-50 text-primary-600 rounded-lg font-semibold hover:bg-primary-100 transition border border-primary-200 text-sm"
                  >
                    👁️ Plats
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
          className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4"
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

      {/* Modal d'édition des paramètres utilisateur */}
      {editingUser && (
        <div
          className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{editingUser.name}</h3>
                <p className="text-sm text-gray-600">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Contenu */}
            <div className="p-4 space-y-5">
              {/* Jour de passage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jour de passage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, delivery_day: day })}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition ${
                        editingUser.delivery_day === day
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Créneau horaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Créneau horaire
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser({ ...editingUser, delivery_time_slot: 'morning' })}
                    className={`py-4 px-3 rounded-xl text-center transition ${
                      editingUser.delivery_time_slot === 'morning'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🌅</span>
                    <span className="font-medium text-sm">Matin</span>
                    <span className="text-xs block opacity-75">8h - 12h</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser({ ...editingUser, delivery_time_slot: 'afternoon' })}
                    className={`py-4 px-3 rounded-xl text-center transition ${
                      editingUser.delivery_time_slot === 'afternoon'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🌇</span>
                    <span className="font-medium text-sm">Après-midi</span>
                    <span className="text-xs block opacity-75">14h - 18h</span>
                  </button>
                </div>
              </div>

              {/* Nombre de personnes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de personnes
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser({
                      ...editingUser,
                      household_size: Math.max(1, (editingUser.household_size || 1) - 1)
                    })}
                    className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 text-xl font-bold hover:bg-gray-300 transition"
                  >
                    -
                  </button>
                  <div className="text-center px-4">
                    <span className="text-4xl font-bold text-primary-600">
                      {editingUser.household_size || 1}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      personne{(editingUser.household_size || 1) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser({
                      ...editingUser,
                      household_size: Math.min(10, (editingUser.household_size || 1) + 1)
                    })}
                    className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 text-xl font-bold hover:bg-gray-300 transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Annuler
              </button>
              <button
                onClick={saveUserSettings}
                disabled={savingUser}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {savingUser ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
