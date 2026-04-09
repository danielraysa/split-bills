import { describe, it, expect } from 'vitest'
import { calculateBillSplit, type BillData } from './calculator'

describe('calculateBillSplit', () => {
  it('should calculate a simple split without tax or discount', () => {
    const data: BillData = {
      people: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' }
      ],
      items: [
        { id: 'i1', name: 'Pizza', price: 20, quantity: 1, sharedBy: ['p1', 'p2'] },
        { id: 'i2', name: 'Soda', price: 5, quantity: 2, sharedBy: ['p1'] }
      ],
      tax: 0,
      discount: 0
    }

    const result = calculateBillSplit(data)

    expect(result.subtotal).toBe(30)
    expect(result.total).toBe(30)
    
    // Alice: Pizza (10) + Soda (10) = 20
    expect(result.personShares['p1'].total).toBe(20)
    // Bob: Pizza (10) = 10
    expect(result.personShares['p2'].total).toBe(10)
  })

  it('should calculate correctly with tax and discount', () => {
    const data: BillData = {
      people: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' }
      ],
      items: [
        { id: 'i1', name: 'Burger', price: 15, quantity: 1, sharedBy: ['p1'] },
        { id: 'i2', name: 'Salad', price: 10, quantity: 1, sharedBy: ['p2'] }
      ],
      tax: 10, // 10%
      discount: 5 // $5 off
    }

    const result = calculateBillSplit(data)

    expect(result.subtotal).toBe(25)
    expect(result.totalDiscount).toBe(5)
    
    // Subtotal after discount: 20
    // Tax: 10% of 20 = 2
    // Total: 22
    expect(result.totalTax).toBe(2)
    expect(result.total).toBe(22)

    // Alice proportion: 15 / 25 = 0.6
    // Alice discount: 5 * 0.6 = 3
    // Alice tax: 2 * 0.6 = 1.2
    // Alice total: 15 - 3 + 1.2 = 13.2
    expect(result.personShares['p1'].total).toBeCloseTo(13.2)

    // Bob proportion: 10 / 25 = 0.4
    // Bob discount: 5 * 0.4 = 2
    // Bob tax: 2 * 0.4 = 0.8
    // Bob total: 10 - 2 + 0.8 = 8.8
    expect(result.personShares['p2'].total).toBeCloseTo(8.8)
  })

  it('should handle items with no sharedBy gracefully', () => {
    const data: BillData = {
      people: [
        { id: 'p1', name: 'Alice' }
      ],
      items: [
        { id: 'i1', name: 'Ghost Item', price: 10, quantity: 1, sharedBy: [] }
      ],
      tax: 0,
      discount: 0
    }

    const result = calculateBillSplit(data)
    expect(result.subtotal).toBe(10)
    expect(result.personShares['p1'].total).toBe(0)
  })
})
