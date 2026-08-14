import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MeasurementType } from '../../types'
import { WEIGHT_UNITS } from '../../lib/constants'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'

interface AddProductFormProps {
  onDone: () => void
}

/** Reveal-on-demand form for creating a new product, used by the Stock tab's "+ Add Product" button. */
export function AddProductForm({ onDone }: AddProductFormProps) {
  const { addProduct } = useAppData()
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [measurementType, setMeasurementType] = useState<MeasurementType>('weight')
  const [weightUnit, setWeightUnit] = useState<string>(WEIGHT_UNITS[0])
  const [countUnit, setCountUnit] = useState('')
  const [openingStock, setOpeningStock] = useState(0)
  const [openingCost, setOpeningCost] = useState(0)

  const unit = measurementType === 'weight' ? weightUnit : countUnit.trim()
  const canSave = name.trim() !== '' && unit !== ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    addProduct({
      name: name.trim(),
      measurementType,
      unit,
      openingStock,
      openingCost,
    })
    showToast('Product added')
    onDone()
  }

  return (
    <form className="card add-product-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="product-name">Name</label>
        <input
          id="product-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ceylon Cinnamon"
          autoFocus
        />
      </div>

      <div className="field">
        <label>Measurement type</label>
        <div className="add-product-form__type-toggle">
          <button
            type="button"
            className={`chip ${measurementType === 'weight' ? 'is-active' : ''}`}
            onClick={() => setMeasurementType('weight')}
          >
            Weight
          </button>
          <button
            type="button"
            className={`chip ${measurementType === 'count' ? 'is-active' : ''}`}
            onClick={() => setMeasurementType('count')}
          >
            Count
          </button>
        </div>
      </div>

      {measurementType === 'weight' ? (
        <div className="field">
          <label htmlFor="product-unit">Unit</label>
          <select id="product-unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
            {WEIGHT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="product-unit">Unit label</label>
          <input
            id="product-unit"
            type="text"
            value={countUnit}
            onChange={(e) => setCountUnit(e.target.value)}
            placeholder="bags, packets, sticks..."
          />
        </div>
      )}

      <div className="add-product-form__row">
        <div className="field">
          <label htmlFor="product-opening-stock">Opening stock</label>
          <input
            id="product-opening-stock"
            className="num"
            type="number"
            min={0}
            step="0.001"
            value={openingStock}
            onChange={(e) => setOpeningStock(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="product-opening-cost">Opening cost / unit</label>
          <input
            id="product-opening-cost"
            className="num"
            type="number"
            min={0}
            step="0.01"
            value={openingCost}
            onChange={(e) => setOpeningCost(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="add-product-form__actions">
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>
          Add Product
        </button>
      </div>
    </form>
  )
}
