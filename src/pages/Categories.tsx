import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { CategoryCard } from '@/components/CategoryCard'
import { Modal } from '@/components/Modal'
import { CategoryForm } from '@/components/CategoryForm'
import { SkeletonList } from '@/components/Skeleton'
import { useData } from '@/hooks/useData'
import type { Category } from '@/types'

export function Categories() {
  const { categories, loading, addCategory, editCategory, removeCategory } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  function openCreate() {
    setEditingCategory(null)
    setFormOpen(true)
  }

  function openEdit(c: Category) {
    setEditingCategory(c)
    setFormOpen(true)
  }

  return (
    <AppLayout title="Categorie" subtitle="Personalizza come organizzi le tue spese">
      {loading ? (
        <SkeletonList label="Caricamento categorie..." />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} onEdit={() => openEdit(c)} onDelete={() => setDeletingCategory(c)} />
          ))}
        </div>
      )}

      <button
        onClick={openCreate}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-4 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
      >
        <Plus size={16} /> Aggiungi categoria
      </button>

      <div className="mt-4 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-sm rounded-2xl p-4">
        Le categorie personalizzate ti permettono di organizzare le tue spese come preferisci. Puoi aggiungerne, modificarle
        o eliminarle in qualsiasi momento.
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingCategory ? 'Modifica categoria' : 'Nuova categoria'}>
        <CategoryForm
          initial={editingCategory ?? undefined}
          onSubmit={async (values) => {
            if (editingCategory) await editCategory(editingCategory.id, values)
            else await addCategory(values)
            setFormOpen(false)
          }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal open={!!deletingCategory} onClose={() => setDeletingCategory(null)} title="Eliminare la categoria?">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Le bollette già registrate con questa categoria non verranno eliminate, ma resteranno senza categoria associata.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={async () => {
              if (deletingCategory) await removeCategory(deletingCategory.id)
              setDeletingCategory(null)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm py-3"
          >
            Elimina definitivamente
          </button>
          <button onClick={() => setDeletingCategory(null)} className="btn-secondary">
            Annulla
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
