import type {
  Customer,
  DocType,
  Expense,
  Payment,
  Product,
  ProductReturn,
  Purchase,
  SaleItem,
  Supplier
} from '@/types'

export type ProductInput = Omit<Product, 'id' | 'createdAt'> & { createdAt?: string }
export type CustomerInput = Omit<Customer, 'id' | 'purchases' | 'totalSpent' | 'createdAt'>
export type SupplierInput = Omit<Supplier, 'id'>
export type ExpenseInput = Omit<Expense, 'id' | 'code'> & { code?: string }
export type PurchaseInput = Omit<Purchase, 'id' | 'code' | 'status'> & {
  code?: string
  status?: Purchase['status']
}
export type ReturnInput = Omit<ProductReturn, 'id' | 'code'> & {
  code?: string
  saleId: string
  saleItemId: string
}

export interface CreateSaleInput {
  items: SaleItem[]
  discount: number
  payments: Payment[]
  docType: DocType
  customer?: { id?: string; name: string; doc: string }
  cashier: string
}
