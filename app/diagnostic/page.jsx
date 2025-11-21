'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function DiagnosticPage() {
  const { data: session, status } = useSession()
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function runDiagnostics() {
      const diagnostics = {}

      // Test 1: Session
      diagnostics.session = {
        status,
        hasSession: !!session,
        user: session?.user || null
      }

      // Test 2: API /api/dishes
      try {
        const response = await fetch('/api/dishes')
        diagnostics.apiDishes = {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        }

        if (response.ok) {
          const data = await response.json()
          diagnostics.apiDishes.dataType = Array.isArray(data) ? 'array' : typeof data
          diagnostics.apiDishes.dataLength = Array.isArray(data) ? data.length : 'N/A'
          diagnostics.apiDishes.sample = Array.isArray(data) && data.length > 0 ? data[0] : data
        } else {
          diagnostics.apiDishes.error = await response.text()
        }
      } catch (error) {
        diagnostics.apiDishes = { error: error.message }
      }

      // Test 3: API /api/dishes?active=true
      try {
        const response = await fetch('/api/dishes?active=true')
        diagnostics.apiDishesActive = {
          status: response.status,
          ok: response.ok
        }

        if (response.ok) {
          const data = await response.json()
          diagnostics.apiDishesActive.dataType = Array.isArray(data) ? 'array' : typeof data
          diagnostics.apiDishesActive.dataLength = Array.isArray(data) ? data.length : 'N/A'
          diagnostics.apiDishesActive.sample = Array.isArray(data) && data.length > 0 ? data[0] : data
        } else {
          diagnostics.apiDishesActive.error = await response.text()
        }
      } catch (error) {
        diagnostics.apiDishesActive = { error: error.message }
      }

      // Test 4: API par catégorie
      try {
        const response = await fetch('/api/dishes?category=viandes')
        diagnostics.apiViandes = {
          status: response.status,
          ok: response.ok
        }

        if (response.ok) {
          const data = await response.json()
          diagnostics.apiViandes.dataLength = Array.isArray(data) ? data.length : 'N/A'
        }
      } catch (error) {
        diagnostics.apiViandes = { error: error.message }
      }

      setResults(diagnostics)
      setLoading(false)
    }

    if (status !== 'loading') {
      runDiagnostics()
    }
  }, [status, session])

  if (loading) {
    return <div className="p-8">Exécution des diagnostics...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Diagnostic FoxFood</h1>

      <div className="space-y-6">
        {Object.entries(results).map(([testName, result]) => (
          <div key={testName} className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-2">{testName}</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
