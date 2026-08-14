import { useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { AddProductForm } from './AddProductForm'
import { ProductRow } from './ProductRow'
import './StockTab.css'

export default function StockTab() {
  const { products, transactions } = useAppData()
  const [isAdding, setIsAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpanded(productId: string) {
    setExpandedId((current) => (current === productId ? null : productId))
  }

  return (
    <div className="stack stock-tab">
      <div className="stock-tab__header">
        <h2 className="section-title">Products</h2>
        <button type="button" className="btn btn-primary" onClick={() => setIsAdding((v) => !v)}>
          {isAdding ? 'Close' : '+ Add Product'}
        </button>
      </div>

      {isAdding && <AddProductForm onDone={() => setIsAdding(false)} />}

      {products.length === 0 ? (
        <p className="empty-state">No products yet — add your first spice to start tracking stock.</p>
      ) : (
        <div className="stock-tab__list">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              transactions={transactions}
              isExpanded={expandedId === product.id}
              onToggle={() => toggleExpanded(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
