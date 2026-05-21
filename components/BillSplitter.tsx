'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Share2, Download, QrCode, Users, Receipt, Calculator, Check, RotateCcw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, generateId } from '@/lib/utils'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { type Person, type Item, type BillData, calculateBillSplit } from '@/lib/calculator'

export default function BillSplitter() {
  const [isMounted, setIsMounted] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [tax, setTax] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  
  const [newPersonName, setNewPersonName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemDiscount, setNewItemDiscount] = useState('')
  const [newItemSharedBy, setNewItemSharedBy] = useState<string[]>([])

  const [activeTab, setActiveTab] = useState<'people' | 'items' | 'results'>('people')
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Load from URL hash or local storage if available
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
    try {
      const hash = window.location.hash
      if (hash && hash.startsWith('#data=')) {
        const dataStr = decodeURIComponent(hash.replace('#data=', ''))
        const data = JSON.parse(atob(dataStr)) as BillData
        if (data.people) setPeople(data.people)
        if (data.items) setItems(data.items)
        if (data.tax !== undefined) setTax(data.tax)
        if (data.discount !== undefined) setDiscount(data.discount)
        
        window.history.replaceState(null, '', window.location.pathname)
        setActiveTab('results')
        return
      }

      const saved = localStorage.getItem('bill-splitter-data')
      if (saved) {
        const data = JSON.parse(saved) as BillData
        if (data.people) setPeople(data.people)
        if (data.items) setItems(data.items)
        if (data.tax !== undefined) setTax(data.tax)
        if (data.discount !== undefined) setDiscount(data.discount)
      }
    } catch (e) {
      console.error('Failed to parse bill data', e)
    }
  }, [])

  // Update local storage when data changes
  useEffect(() => {
    if (!isMounted) return
    const data: BillData = { people, items, tax, discount }
    localStorage.setItem('bill-splitter-data', JSON.stringify(data))
  }, [people, items, tax, discount, isMounted])

  const addPerson = () => {
    if (!newPersonName.trim()) return
    const newPerson = { id: generateId(), name: newPersonName.trim() }
    setPeople([...people, newPerson])
    setNewItemSharedBy([...newItemSharedBy, newPerson.id]) // Auto-select new person for current item
    setNewPersonName('')
  }

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id))
    setItems(items.map(item => ({
      ...item,
      sharedBy: item.sharedBy.filter(pid => pid !== id)
    })))
    setNewItemSharedBy(newItemSharedBy.filter(pid => pid !== id))
  }

  const togglePersonForItem = (personId: string) => {
    if (newItemSharedBy.includes(personId)) {
      setNewItemSharedBy(newItemSharedBy.filter(id => id !== personId))
    } else {
      setNewItemSharedBy([...newItemSharedBy, personId])
    }
  }

  const addItem = () => {
    if (!newItemName.trim() || !newItemPrice || newItemSharedBy.length === 0) return
    const price = parseFloat(newItemPrice)
    const quantity = parseInt(newItemQuantity) || 1
    const itemDiscount = parseFloat(newItemDiscount) || 0
    if (isNaN(price) || price < 0) return

    setItems([...items, {
      id: generateId(),
      name: newItemName.trim(),
      price,
      quantity,
      discount: itemDiscount,
      sharedBy: newItemSharedBy
    }])
    
    setNewItemName('')
    setNewItemPrice('')
    setNewItemQuantity('1')
    setNewItemDiscount('')
    // Keep the same sharedBy selection for convenience
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const saveEditedPerson = () => {
    if (!editingPerson || !editingPerson.name.trim()) return
    setPeople(people.map(p => p.id === editingPerson.id ? editingPerson : p))
    setEditingPerson(null)
  }

  const saveEditedItem = () => {
    if (!editingItem || !editingItem.name.trim() || isNaN(editingItem.price) || editingItem.sharedBy.length === 0) return
    setItems(items.map(item => item.id === editingItem.id ? editingItem : item))
    setEditingItem(null)
  }

  const handleReset = () => {
    setPeople([])
    setItems([])
    setTax(0)
    setDiscount(0)
    setActiveTab('people')
    window.history.replaceState(null, '', window.location.pathname)
    setIsResetDialogOpen(false)
  }

  const results = calculateBillSplit({ people, items, tax, discount })

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return
    try {
      const url = await toPng(receiptRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      const link = document.createElement('a')
      link.download = 'bill-split.png'
      link.href = url
      link.click()
    } catch (err) {
      console.error('Failed to generate image', err)
      alert('Failed to generate image. Try opening the app in a new tab if you are inside an iframe.')
    }
  }

  const [shareUrl, setShareUrl] = useState('')

  const generateShareUrl = () => {
    const data: BillData = { people, items, tax, discount }
    const dataStr = btoa(JSON.stringify(data))
    const url = new URL(window.location.href)
    url.hash = `data=${encodeURIComponent(dataStr)}`
    setShareUrl(url.toString())
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bill Split',
          text: 'Here is our bill split!',
          url: shareUrl,
        })
      } catch (err) {
        console.error('Error sharing', err)
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      alert('Link copied to clipboard!')
    }
  }

  if (!isMounted) return null

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-sm mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Split the Bill</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">Fair and square, no math required.</p>
        </div>
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogTrigger render={<Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 rounded-xl" title="Start Over" />}>
            <RotateCcw className="w-5 h-5" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Start Over?</DialogTitle>
              <DialogDescription>This will clear all people, items, and results. This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReset}>Yes, Clear All</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="px-4 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-muted p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'people' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-4 h-4" />
            People
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'items' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Receipt className="w-4 h-4" />
            Items
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'results' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Calculator className="w-4 h-4" />
            Results
          </button>
        </div>

        {/* Tab Content: People */}
        {activeTab === 'people' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Who is paying?</CardTitle>
                <CardDescription>Add everyone involved in the bill.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input 
                    placeholder="Enter name..." 
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                    className="bg-muted/50 border-none"
                  />
                  <Button onClick={addPerson} size="icon" className="shrink-0 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {people.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No people added yet.
                    </div>
                  ) : (
                    people.map(person => (
                      <div key={person.id} className="flex items-center justify-between bg-muted/30 p-3 rounded-xl">
                        <span className="font-medium">{person.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditingPerson(person)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removePerson(person.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
              {people.length > 0 && (
                <CardFooter>
                  <Button className="w-full rounded-xl" onClick={() => setActiveTab('items')}>
                    Continue to Items
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}

        {/* Tab Content: Items */}
        {activeTab === 'items' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Add Items</CardTitle>
                <CardDescription>What did you order?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12">
                    <Label className="text-xs text-muted-foreground mb-1 block">Item Name</Label>
                    <Input 
                      placeholder="e.g. Pizza" 
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="bg-muted/50 border-none"
                    />
                  </div>
                  <div className="col-span-5">
                    <Label className="text-xs text-muted-foreground mb-1 block">Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        className="bg-muted/50 border-none pl-8"
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      className="bg-muted/50 border-none"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground mb-1 block">Disc (Opt)</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        value={newItemDiscount}
                        onChange={(e) => setNewItemDiscount(e.target.value)}
                        className="bg-muted/50 border-none pl-7"
                      />
                    </div>
                  </div>
                </div>

                {people.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Shared by</Label>
                    <div className="flex flex-wrap gap-2">
                      {people.map(person => {
                        const isSelected = newItemSharedBy.includes(person.id)
                        return (
                          <button
                            key={person.id}
                            onClick={() => togglePersonForItem(person.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            {person.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={addItem} 
                  className="w-full rounded-xl" 
                  disabled={!newItemName || !newItemPrice || newItemSharedBy.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>

                <Separator className="my-4" />

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No items added yet.
                    </div>
                  ) : (
                    items.map(item => (
                      <div key={item.id} className="bg-muted/30 p-3 rounded-xl flex justify-between items-start">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {item.quantity > 1 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.quantity}x</span>}
                            {item.name}
                          </div>
                          {item.discount && item.discount > 0 ? (
                            <div className="text-xs text-emerald-600 mt-0.5">
                              Discount: -{formatCurrency(item.discount)}
                            </div>
                          ) : null}
                          <div className="text-xs text-muted-foreground mt-1">
                            Shared by: {item.sharedBy.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold mr-2">{formatCurrency((item.price * item.quantity) - (item.discount || 0))}</span>
                          <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)} className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
              {items.length > 0 && (
                <CardFooter>
                  <Button className="w-full rounded-xl" onClick={() => setActiveTab('results')} variant="secondary">
                    View Results
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        )}

        {/* Tab Content: Results */}
        {activeTab === 'results' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Extras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Tax (%)</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={tax || ''}
                        onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                        className="bg-muted/50 border-none pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Discount (Rp)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                      <Input 
                        type="number" 
                        value={discount || ''}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="bg-muted/50 border-none pl-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* The Receipt to be captured */}
            <div ref={receiptRef} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-slate-900" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bill Split</h2>
                <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </div>

              <div className="space-y-4">
                {people.map(person => {
                  const share = results.personShares[person.id]
                  if (!share || share.total === 0) return null
                  
                  return (
                    <div key={person.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-lg">{person.name}</span>
                        <span className="font-bold text-lg text-teal-600">{formatCurrency(share.total)}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <div className="flex justify-between">
                          <span>Items</span>
                          <span>{formatCurrency(share.items)}</span>
                        </div>
                        {share.tax > 0 && (
                          <div className="flex justify-between">
                            <span>Tax</span>
                            <span>{formatCurrency(share.tax)}</span>
                          </div>
                        )}
                        {share.discount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Discount</span>
                            <span>-{formatCurrency(share.discount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="my-6 h-px w-full bg-slate-200" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(results.subtotal)}</span>
                </div>
                {results.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(results.totalDiscount)}</span>
                  </div>
                )}
                {results.totalTax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>{formatCurrency(results.totalTax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-100 mt-2">
                  <span>Total</span>
                  <span className="text-teal-600">{formatCurrency(results.total)}</span>
                </div>
              </div>
              
              <div className="mt-8 text-center text-xs text-slate-400">
                Generated with Split the Bill
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-8">
              <Button onClick={handleDownloadImage} variant="outline" className="rounded-xl bg-white h-12">
                <Download className="w-4 h-4 mr-2" /> Save Image
              </Button>
              
              <Dialog onOpenChange={(open) => {
                if (open) generateShareUrl()
              }}>
                <DialogTrigger render={<Button className="rounded-xl h-12" />}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Share Bill</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center justify-center py-6 space-y-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border">
                      <QRCodeSVG value={shareUrl} size={200} />
                    </div>
                    <p className="text-sm text-center text-muted-foreground">
                      Scan this QR code to open the bill, or share the link below.
                    </p>
                    <div className="flex w-full gap-2">
                      <Input readOnly value={shareUrl} className="bg-muted/50" />
                      <Button onClick={handleShare} className="shrink-0">
                        Copy
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

          </div>
        )}
      </div>

      {/* Edit Person Dialog */}
      <Dialog open={!!editingPerson} onOpenChange={(open) => !open && setEditingPerson(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>
          {editingPerson && (
             <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
                  <Input 
                    value={editingPerson.name} 
                    onChange={(e) => setEditingPerson({...editingPerson, name: e.target.value})}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditedPerson()}
                  />
                </div>
                <Button onClick={saveEditedPerson} className="w-full rounded-xl">Save Changes</Button>
             </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
             <div className="space-y-4 pt-4">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12">
                    <Label className="text-xs text-muted-foreground mb-1 block">Item Name</Label>
                    <Input 
                      value={editingItem.name} 
                      onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    />
                  </div>
                  <div className="col-span-5">
                    <Label className="text-xs text-muted-foreground mb-1 block">Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                      <Input 
                        type="number" 
                        value={editingItem.price || ''}
                        onChange={(e) => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={editingItem.quantity || ''}
                      onChange={(e) => setEditingItem({...editingItem, quantity: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground mb-1 block">Disc (Opt)</Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                      <Input 
                        type="number" 
                        value={editingItem.discount || ''}
                        onChange={(e) => setEditingItem({...editingItem, discount: parseFloat(e.target.value) || 0})}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                {people.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Shared by</Label>
                    <div className="flex flex-wrap gap-2">
                      {people.map(person => {
                        const isSelected = editingItem.sharedBy.includes(person.id)
                        return (
                          <button
                            key={person.id}
                            onClick={() => {
                              if (isSelected) {
                                setEditingItem({...editingItem, sharedBy: editingItem.sharedBy.filter(id => id !== person.id)})
                              } else {
                                setEditingItem({...editingItem, sharedBy: [...editingItem.sharedBy, person.id]})
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            {person.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                <Button onClick={saveEditedItem} disabled={editingItem.sharedBy.length === 0} className="w-full rounded-xl">Save Changes</Button>
             </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
