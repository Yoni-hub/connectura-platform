import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const formatDate = (value) => {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString()
}

export default function PassportHome() {
  const nav = useNavigate()
  const [instances, setInstances] = useState([])
  const [schemaProducts, setSchemaProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [existingProductId, setExistingProductId] = useState('')
  const [customProductName, setCustomProductName] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [instancesRes, productsRes] = await Promise.all([
        api.get('/passport/products'),
        api.get('/passport/schema/products'),
      ])
      const products = Array.isArray(instancesRes.data?.products) ? instancesRes.data.products : []
      const schema = Array.isArray(productsRes.data?.products) ? productsRes.data.products : []
      setInstances(products)
      setSchemaProducts(schema)
      if (!existingProductId && schema.length) {
        setExistingProductId(String(schema[0].id))
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load My Passport')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const createFromExisting = async () => {
    if (!existingProductId) {
      toast.error('Select a product')
      return
    }
    setCreating(true)
    try {
      const res = await api.post('/passport/products/admin', { adminProductId: Number(existingProductId) })
      const created = res.data?.product
      if (!created?.id) {
        toast.error('Could not create product instance')
        return
      }
      nav(`/passport/products/${created.id}`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create passport product')
    } finally {
      setCreating(false)
    }
  }

  const createCustom = async () => {
    const productName = customProductName.trim()
    if (!productName) {
      toast.error('Enter a custom product name')
      return
    }
    setCreating(true)
    try {
      const res = await api.post('/passport/products/custom', { productName })
      const created = res.data?.product
      if (!created?.id) {
        toast.error('Could not create custom product')
        return
      }
      nav(`/passport/products/${created.id}`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create custom product')
    } finally {
      setCreating(false)
    }
  }

  const removeInstance = async (instanceId) => {
    if (!instanceId) return
    setRemovingId(instanceId)
    try {
      await api.delete(`/passport/products/${instanceId}`)
      setInstances((prev) => prev.filter((row) => row.id !== instanceId))
      toast.success('Product removed')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to remove product')
    } finally {
      setRemovingId('')
    }
  }

  return (
    <main className="page-shell py-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Passport</h1>
            <p className="text-sm text-slate-600">
              You can create your own forms or choose from existing products.
            </p>
          </div>
          <Link className="pill-btn-ghost px-3 py-1.5 text-sm" to="/client/dashboard">
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Choose existing product</div>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={existingProductId}
              onChange={(event) => setExistingProductId(event.target.value)}
            >
              <option value="">Select product</option>
              {schemaProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <button type="button" className="pill-btn-primary w-full justify-center" onClick={createFromExisting} disabled={creating}>
              {creating ? 'Creating...' : 'Create from existing'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Create custom product</div>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={customProductName}
              onChange={(event) => setCustomProductName(event.target.value)}
              placeholder="Custom product name"
            />
            <button type="button" className="pill-btn-primary w-full justify-center" onClick={createCustom} disabled={creating}>
              {creating ? 'Creating...' : 'Create custom'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">My Passport products</div>
            <button type="button" className="pill-btn-ghost px-3 py-1 text-xs" onClick={loadData} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <div className="text-sm text-slate-500">Loading products...</div>}
          {!loading && instances.length === 0 && (
            <div className="text-sm text-slate-500">No passport products yet.</div>
          )}
          {!loading && instances.length > 0 && (
            <div className="space-y-2">
              {instances.map((instance) => (
                <div key={instance.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{instance.productName}</div>
                      <div className="text-xs text-slate-500">
                        Source: {instance.productSource === 'CUSTOM_PRODUCT' ? 'Custom' : 'Admin Product'} | Last updated: {formatDate(instance.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="pill-btn-ghost px-3 py-1 text-xs"
                        onClick={() => nav(`/passport/products/${instance.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="pill-btn-ghost px-3 py-1 text-xs text-red-600"
                        onClick={() => removeInstance(instance.id)}
                        disabled={removingId === instance.id}
                      >
                        {removingId === instance.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
