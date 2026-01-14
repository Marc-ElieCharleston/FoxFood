'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

export default function AdminCustomDishesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('approved') // approved (défaut), rejected, all
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      // Vérifier que l'utilisateur est admin
      if (session.user.role !== 'admin') {
        router.push('/')
        return
      }
      fetchRequests()
    }
  }, [status, session, router, filter])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/admin/custom-dishes'
        : `/api/admin/custom-dishes?status=${filter}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des demandes:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (request) => {
    setSelectedRequest(request)
    setAdminNotes('')
    setShowModal(true)
  }

  const handleRejectRequest = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/admin/custom-dishes/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: adminNotes
        })
      })

      if (response.ok) {
        toast.success('Demande rejetée et plat désactivé')
        setShowModal(false)
        setSelectedRequest(null)
        fetchRequests()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors du rejet')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du rejet')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (requestId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette demande ?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/custom-dishes/${requestId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Demande supprimée')
        fetchRequests()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Validée' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejetée' }
    }
    const badge = badges[status] || badges.approved
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  const approvedCount = requests.filter(r => r.status === 'approved').length

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Plats personnalisés</h1>
          <p className="text-gray-600 text-sm">
            Les demandes sont validées automatiquement. Refusez-les si besoin.
          </p>
        </div>
        {approvedCount > 0 && (
          <div className="bg-green-500 text-white px-4 py-2 rounded-full font-bold">
            {approvedCount} validée{approvedCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <AdminNav />

      {/* Filtres */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[
          { value: 'approved', label: 'Validées', count: requests.filter(r => r.status === 'approved').length },
          { value: 'rejected', label: 'Rejetées', count: requests.filter(r => r.status === 'rejected').length },
          { value: 'all', label: 'Toutes', count: requests.length }
        ].map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              filter === value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Liste des demandes */}
      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucune demande {filter !== 'all' && `(${filter})`}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{request.dish_name}</h3>
                    {getStatusBadge(request.status)}
                    {request.is_detailed && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Détaillée
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Par <strong>{request.user_name}</strong> ({request.user_email})
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(request.created_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Description :</p>
                  <p className="text-sm text-gray-600">{request.description}</p>
                </div>

                {request.is_detailed && request.suggested_ingredients?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Ingrédients suggérés :</p>
                    <div className="flex flex-wrap gap-2">
                      {request.suggested_ingredients.map((ingredient, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {request.admin_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Notes admin :</p>
                    <p className="text-sm text-gray-600">{request.admin_notes}</p>
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="flex justify-end pt-3">
                    <button
                      onClick={() => handleOpenModal(request)}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                      Refuser ce plat
                    </button>
                  </div>
                )}

                {request.status === 'rejected' && (
                  <div className="flex justify-end pt-3">
                    <button
                      onClick={() => handleDelete(request.id)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de rejet */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-red-600">
              Refuser ce plat personnalisé
            </h3>

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-800">{selectedRequest.dish_name}</p>
              <p className="text-xs text-gray-600">Demandé par {selectedRequest.user_name}</p>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Le plat sera désactivé du catalogue et le client sera notifié.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison du refus (recommandé)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Ex: Ingrédients non disponibles, trop complexe, etc."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRejectRequest}
                disabled={processing}
                className="flex-1 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Rejet en cours...' : 'Confirmer le refus'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={processing}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
