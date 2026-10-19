import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Modal } from '@/components/Modal'
import { BillForm } from '@/components/BillForm'
import { UNIT_LABELS } from '@/types'
import { useData } from '@/hooks/useData'

export function BillDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { bills, categories, editBill, removeBill } = useData()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const bill = bills.find((b) => b.id === id)
  const category = categories.find((c) => c.id === bill?.category_id)

  if (!bill) {
    return (
      <AppLayout title="Bolletta non trovata">
        <button onClick={() => navigate('/bills')} className="text-brand-600 flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Torna alle bollette
        </button>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Dettaglio bolletta">
      <button onClick={() => navigate('/bills')} className="mb-4 text-brand-600 flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Torna alle bollette
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-5 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${category?.color ?? '#94a3b8'}20` }}
          >
            {category?.icon ?? '📄'}
          </div>
          <div>
            <p className="font-semibold text-lg text-slate-900 dark:text-white">{category?.name ?? 'Categoria eliminata'}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {Number(bill.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Periodo di fatturazione">
            {new Date(bill.billing_start).toLocaleDateString('it-IT')} – {new Date(bill.billing_end).toLocaleDateString('it-IT')}
          </Row>
          {bill.consumption_value != null && (
            <Row label="Consumo">
              {bill.consumption_value} {bill.consumption_unit ? UNIT_LABELS[bill.consumption_unit] : ''}
            </Row>
          )}
          <Row label="Data di scadenza">{bill.due_date ? new Date(bill.due_date).toLocaleDateString('it-IT') : '—'}</Row>
          <Row label="Note">{bill.notes || '—'}</Row>
        </dl>

        <div className="flex gap-2 mt-6">
          <button onClick={() => setEditing(true)} className="btn-secondary flex-1">
            <Pencil size={16} /> Modifica
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 font-medium text-sm py-3">
            <Trash2 size={16} /> Elimina
          </button>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifica bolletta">
        <BillForm
          categories={categories}
          initial={bill}
          onSubmit={async (values) => {
            await editBill(bill.id, values)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminare la bolletta?">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Questa azione non può essere annullata.</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={async () => {
              await removeBill(bill.id)
              navigate('/bills')
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm py-3"
          >
            Elimina definitivamente
          </button>
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary">
            Annulla
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-800 dark:text-slate-200 font-medium">{children}</dd>
    </div>
  )
}
