import { useState } from 'react'
import type { Product } from '../../types'
import { formatCurrency, formatQtyWithUnit } from '../../lib/format'
import './ProductPicker.css'

interface ProductPickerProps {
  products: Product[]
  selectedProductId: string | null
  onSelect: (productId: string) => void
}

/** Search-and-select control for choosing a product on the Entry tab. */
export function ProductPicker({ products, selectedProductId, onSelect }: ProductPickerProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  if (products.length === 0) {
    return (
      <div className="product-picker">
        <p className="empty-state">No products yet — add one in the Stock tab.</p>
      </div>
    )
  }

  const selectedProduct = selectedProductId
    ? products.find((product) => product.id === selectedProductId) ?? null
    : null

  function handleSelect(productId: string) {
    onSelect(productId)
    setIsSearchOpen(false)
    setQuery('')
  }

  if (selectedProduct && !isSearchOpen) {
    return (
      <div className="product-picker">
        <div className="product-picker-selected">
          <div className="product-picker-selected-info">
            <span className="product-picker-selected-name">{selectedProduct.name}</span>
            <span className="product-picker-selected-meta num">
              Stock: {formatQtyWithUnit(selectedProduct.stock, selectedProduct.unit)} · Avg cost:{' '}
              {formatCurrency(selectedProduct.avgCost)}
            </span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setIsSearchOpen(true)}>
            Change
          </button>
        </div>
      </div>
    )
  }

  const trimmedQuery = query.trim().toLowerCase()
  const filteredProducts =
    trimmedQuery === ''
      ? products
      : products.filter((product) => product.name.toLowerCase().includes(trimmedQuery))

  return (
    <div className="product-picker">
      <div className="field">
        <input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      </div>
      <div className="product-picker-list">
        {filteredProducts.length === 0 ? (
          <p className="empty-state">No matching products.</p>
        ) : (
          filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="product-picker-row"
              onClick={() => handleSelect(product.id)}
            >
              <span className="product-picker-row-name">{product.name}</span>
              <span className="product-picker-row-meta num">
                {formatQtyWithUnit(product.stock, product.unit)} · {formatCurrency(product.avgCost)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
