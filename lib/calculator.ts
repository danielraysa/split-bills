export type Person = {
  id: string
  name: string
}

export type Item = {
  id: string
  name: string
  price: number
  quantity: number
  discount?: number
  sharedBy: string[] // array of person ids
}

export type BillData = {
  people: Person[]
  items: Item[]
  tax: number
  discount: number
}

export function calculateBillSplit(data: BillData) {
  const { people, items, tax, discount } = data

  let subtotal = 0
  const itemTotals: Record<string, number> = {}

  items.forEach(item => {
    const itemTotal = Math.max(0, (item.price * item.quantity) - (item.discount || 0))
    itemTotals[item.id] = itemTotal
    subtotal += itemTotal
  })

  const totalDiscount = discount
  const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount)
  const totalTax = subtotalAfterDiscount * (tax / 100)
  const total = subtotalAfterDiscount + totalTax

  // Calculate each person's share
  const personShares: Record<string, { items: number, tax: number, discount: number, total: number }> = {}
  people.forEach(p => {
    personShares[p.id] = { items: 0, tax: 0, discount: 0, total: 0 }
  })

  items.forEach(item => {
    if (item.sharedBy.length === 0) return
    const costPerPerson = itemTotals[item.id] / item.sharedBy.length
    item.sharedBy.forEach(pid => {
      if (personShares[pid]) {
        personShares[pid].items += costPerPerson
      }
    })
  })

  // Distribute tax and discount proportionally based on item share
  people.forEach(p => {
    const share = personShares[p.id]
    const proportion = subtotal > 0 ? share.items / subtotal : 0
    share.discount = totalDiscount * proportion
    share.tax = totalTax * proportion
    share.total = share.items - share.discount + share.tax
  })

  return { subtotal, totalDiscount, totalTax, total, personShares }
}
