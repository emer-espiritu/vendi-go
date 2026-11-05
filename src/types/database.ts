
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"created_at": string,"entity": string,"entity_id": string | null,"id": string,"ip": unknown,"new_data": Json | null,"old_data": Json | null,"user_agent": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: string,"ip"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: string,"ip"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "active": boolean,"created_at": string,"deleted_at": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cash_movements": {
                  Row: {
                    "amount": number,"cash_session_id": string,"created_at": string,"description": string,"id": string,"reference": string | null,"type": Database["public"]['Enums']["cash_movement_type"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cash_session_id": string,"created_at"?: string,"description"?: string,"id"?: string,"reference"?: string | null,"type": Database["public"]['Enums']["cash_movement_type"],"user_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cash_session_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"reference"?: string | null,"type"?: Database["public"]['Enums']["cash_movement_type"],"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_movements_cash_session_id_fkey"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_movements_cash_session_id_fkey"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "v_cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_movements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_registers": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"deleted_at": string | null,"id": string,"name": string,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_registers_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "cash_registers_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "cash_registers_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_sessions": {
                  Row: {
                    "cash_register_id": string,"closed_at": string | null,"counted_total": number | null,"created_at": string,"difference": number | null,"expected_total": number,"expenses_total": number,"id": string,"notes": string | null,"opened_at": string,"opening_amount": number,"sales_total": number,"status": Database["public"]['Enums']["cash_session_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cash_register_id": string,"closed_at"?: string | null,"counted_total"?: number | null,"created_at"?: string,"difference"?: number | null,"expected_total"?: number,"expenses_total"?: number,"id"?: string,"notes"?: string | null,"opened_at"?: string,"opening_amount"?: number,"sales_total"?: number,"status"?: Database["public"]['Enums']["cash_session_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cash_register_id"?: string,"closed_at"?: string | null,"counted_total"?: number | null,"created_at"?: string,"difference"?: number | null,"expected_total"?: number,"expenses_total"?: number,"id"?: string,"notes"?: string | null,"opened_at"?: string,"opening_amount"?: number,"sales_total"?: number,"status"?: Database["public"]['Enums']["cash_session_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_sessions_cash_register_id_fkey"
      columns: ["cash_register_id"]
isOneToOne: false
      referencedRelation: "cash_registers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"color": string,"created_at": string,"deleted_at": string | null,"emoji": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"emoji"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"color"?: string,"created_at"?: string,"deleted_at"?: string | null,"emoji"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "active": boolean,"address": string,"created_at": string,"deleted_at": string | null,"doc_number": string | null,"doc_type": Database["public"]['Enums']["identity_doc_type"],"email": string,"id": string,"name": string,"phone": string,"purchases_count": number,"segment": Database["public"]['Enums']["customer_segment"],"total_spent": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string,"created_at"?: string,"deleted_at"?: string | null,"doc_number"?: string | null,"doc_type"?: Database["public"]['Enums']["identity_doc_type"],"email"?: string,"id"?: string,"name": string,"phone"?: string,"purchases_count"?: number,"segment"?: Database["public"]['Enums']["customer_segment"],"total_spent"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string,"created_at"?: string,"deleted_at"?: string | null,"doc_number"?: string | null,"doc_type"?: Database["public"]['Enums']["identity_doc_type"],"email"?: string,"id"?: string,"name"?: string,"phone"?: string,"purchases_count"?: number,"segment"?: Database["public"]['Enums']["customer_segment"],"total_spent"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"document_sequences": {
                  Row: {
                    "current_number": number,"series_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_number"?: number,"series_id": string,"updated_at"?: string
                  }
                  Update: {
                    "current_number"?: number,"series_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_sequences_series_id_fkey"
      columns: ["series_id"]
isOneToOne: true
      referencedRelation: "document_series"
      referencedColumns: ["id"]
    }
                  ]
                },"document_series": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string,"doc_type": Database["public"]['Enums']["document_type"],"id": string,"series": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"doc_type": Database["public"]['Enums']["document_type"],"id"?: string,"series": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"doc_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"series"?: string
                  }
                  Relationships: [
                    
                  ]
                },"expense_categories": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"cash_session_id": string | null,"category_id": string | null,"code": string,"created_at": string,"date": string,"deleted_at": string | null,"description": string,"id": string,"payment_method_id": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cash_session_id"?: string | null,"category_id"?: string | null,"code": string,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"payment_method_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cash_session_id"?: string | null,"category_id"?: string | null,"code"?: string,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"payment_method_id"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_cash_session_fk"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_cash_session_fk"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "v_cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory": {
                  Row: {
                    "id": string,"product_id": string,"reserved": number,"stock": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"product_id": string,"reserved"?: number,"stock"?: number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "id"?: string,"product_id"?: string,"reserved"?: number,"stock"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "inventory_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inventory_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inventory_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"qty": number,"reason": string,"reference": string | null,"stock_after": number,"type": Database["public"]['Enums']["movement_type"],"user_id": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"qty": number,"reason"?: string,"reference"?: string | null,"stock_after": number,"type": Database["public"]['Enums']["movement_type"],"user_id"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"qty"?: number,"reason"?: string,"reference"?: string | null,"stock_after"?: number,"type"?: Database["public"]['Enums']["movement_type"],"user_id"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "inventory_movements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inventory_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "inventory_movements_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"doc_type": Database["public"]['Enums']["document_type"],"hash": string | null,"id": string,"issued_at": string | null,"number": string,"pdf_url": string | null,"sale_id": string,"series": string,"status": string,"xml_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doc_type"?: Database["public"]['Enums']["document_type"],"hash"?: string | null,"id"?: string,"issued_at"?: string | null,"number": string,"pdf_url"?: string | null,"sale_id": string,"series": string,"status"?: string,"xml_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: Database["public"]['Enums']["document_type"],"hash"?: string | null,"id"?: string,"issued_at"?: string | null,"number"?: string,"pdf_url"?: string | null,"sale_id"?: string,"series"?: string,"status"?: string,"xml_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: true
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"id": string,"kind": string,"name": string,"requires_reference": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"id"?: string,"kind": string,"name": string,"requires_reference"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"requires_reference"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"permissions": {
                  Row: {
                    "action": string,"code": string,"created_at": string,"description": string,"module": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"code": string,"created_at"?: string,"description"?: string,"module": string
                  }
                  Update: {
                    "action"?: string,"code"?: string,"created_at"?: string,"description"?: string,"module"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_presentations": {
                  Row: {
                    "active": boolean,"barcode": string | null,"created_at": string,"factor": number,"id": string,"is_base": boolean,"label": string,"price": number,"product_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barcode"?: string | null,"created_at"?: string,"factor": number,"id"?: string,"is_base"?: boolean,"label": string,"price": number,"product_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"barcode"?: string | null,"created_at"?: string,"factor"?: number,"id"?: string,"is_base"?: boolean,"label"?: string,"price"?: number,"product_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_presentations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_presentations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"barcode": string | null,"base_unit": Database["public"]['Enums']["base_unit"],"brand_id": string | null,"category_id": string | null,"cost": number,"created_at": string,"deleted_at": string | null,"emoji": string,"expires_at": string | null,"id": string,"image_url": string | null,"min_stock": number,"name": string,"pack_size": number | null,"price": number,"purchase_unit": Database["public"]['Enums']["purchase_unit"] | null,"sku": string,"supplier_id": string | null,"tax_rate": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"barcode"?: string | null,"base_unit"?: Database["public"]['Enums']["base_unit"],"brand_id"?: string | null,"category_id"?: string | null,"cost"?: number,"created_at"?: string,"deleted_at"?: string | null,"emoji"?: string,"expires_at"?: string | null,"id"?: string,"image_url"?: string | null,"min_stock"?: number,"name": string,"pack_size"?: number | null,"price"?: number,"purchase_unit"?: Database["public"]['Enums']["purchase_unit"] | null,"sku": string,"supplier_id"?: string | null,"tax_rate"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"barcode"?: string | null,"base_unit"?: Database["public"]['Enums']["base_unit"],"brand_id"?: string | null,"category_id"?: string | null,"cost"?: number,"created_at"?: string,"deleted_at"?: string | null,"emoji"?: string,"expires_at"?: string | null,"id"?: string,"image_url"?: string | null,"min_stock"?: number,"name"?: string,"pack_size"?: number | null,"price"?: number,"purchase_unit"?: Database["public"]['Enums']["purchase_unit"] | null,"sku"?: string,"supplier_id"?: string | null,"tax_rate"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"avatar_url": string | null,"created_at": string,"deleted_at": string | null,"email": string,"full_name": string,"id": string,"last_access_at": string | null,"phone": string,"role_code": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"avatar_url"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email": string,"full_name"?: string,"id": string,"last_access_at"?: string | null,"phone"?: string,"role_code"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"avatar_url"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"last_access_at"?: string | null,"phone"?: string,"role_code"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_role_code_fkey"
      columns: ["role_code"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["code"]
    }
                  ]
                },"purchase_items": {
                  Row: {
                    "base_qty": number,"discount": number,"factor": number,"id": string,"name": string,"presentation_id": string | null,"product_id": string,"purchase_id": string,"qty": number,"subtotal": number,"unit": string,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_qty": number,"discount"?: number,"factor"?: number,"id"?: string,"name"?: string,"presentation_id"?: string | null,"product_id": string,"purchase_id": string,"qty": number,"subtotal"?: number,"unit"?: string,"unit_cost"?: number
                  }
                  Update: {
                    "base_qty"?: number,"discount"?: number,"factor"?: number,"id"?: string,"name"?: string,"presentation_id"?: string | null,"product_id"?: string,"purchase_id"?: string,"qty"?: number,"subtotal"?: number,"unit"?: string,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_presentation_id_fkey"
      columns: ["presentation_id"]
isOneToOne: false
      referencedRelation: "product_presentations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "code": string,"created_at": string,"date": string,"deleted_at": string | null,"document_type": Database["public"]['Enums']["document_type"],"id": string,"notes": string | null,"status": Database["public"]['Enums']["purchase_status"],"subtotal": number,"supplier_id": string,"tax": number,"total": number,"updated_at": string,"user_id": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"document_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["purchase_status"],"subtotal"?: number,"supplier_id": string,"tax"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"date"?: string,"deleted_at"?: string | null,"document_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["purchase_status"],"subtotal"?: number,"supplier_id"?: string,"tax"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_orders_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "purchase_orders_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "purchase_orders_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_return_items": {
                  Row: {
                    "base_qty": number,"id": string,"product_id": string,"purchase_item_id": string,"qty": number,"return_id": string,"subtotal": number,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_qty": number,"id"?: string,"product_id": string,"purchase_item_id": string,"qty": number,"return_id": string,"subtotal"?: number,"unit_cost"?: number
                  }
                  Update: {
                    "base_qty"?: number,"id"?: string,"product_id"?: string,"purchase_item_id"?: string,"qty"?: number,"return_id"?: string,"subtotal"?: number,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_return_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_return_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "purchase_return_items_purchase_item_id_fkey"
      columns: ["purchase_item_id"]
isOneToOne: false
      referencedRelation: "purchase_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_return_items_return_id_fkey"
      columns: ["return_id"]
isOneToOne: false
      referencedRelation: "purchase_returns"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_returns": {
                  Row: {
                    "code": string,"created_at": string,"date": string,"id": string,"purchase_id": string,"reason": string,"status": Database["public"]['Enums']["return_status"],"supplier_id": string,"total": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"date"?: string,"id"?: string,"purchase_id": string,"reason"?: string,"status"?: Database["public"]['Enums']["return_status"],"supplier_id": string,"total"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"date"?: string,"id"?: string,"purchase_id"?: string,"reason"?: string,"status"?: Database["public"]['Enums']["return_status"],"supplier_id"?: string,"total"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_returns_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_returns_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"permission_code": string,"role_code": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"permission_code": string,"role_code": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "created_at"?: string,"permission_code"?: string,"role_code"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_code_fkey"
      columns: ["permission_code"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "role_permissions_role_code_fkey"
      columns: ["role_code"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["code"]
    }
                  ]
                },"roles": {
                  Row: {
                    "code": Database["public"]['Enums']["app_role"],"created_at": string,"description": string,"is_system": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": Database["public"]['Enums']["app_role"],"created_at"?: string,"description"?: string,"is_system"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: Database["public"]['Enums']["app_role"],"created_at"?: string,"description"?: string,"is_system"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sale_items": {
                  Row: {
                    "base_qty": number,"base_unit": Database["public"]['Enums']["base_unit"],"discount": number,"factor": number,"id": string,"name": string,"presentation_id": string,"presentation_label": string,"product_id": string,"profit": number,"qty": number,"sale_id": string,"sku": string,"subtotal": number,"total_cost": number,"unit_cost": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_qty": number,"base_unit": Database["public"]['Enums']["base_unit"],"discount"?: number,"factor": number,"id"?: string,"name": string,"presentation_id": string,"presentation_label": string,"product_id": string,"profit"?: number,"qty": number,"sale_id": string,"sku": string,"subtotal": number,"total_cost"?: number,"unit_cost"?: number,"unit_price": number
                  }
                  Update: {
                    "base_qty"?: number,"base_unit"?: Database["public"]['Enums']["base_unit"],"discount"?: number,"factor"?: number,"id"?: string,"name"?: string,"presentation_id"?: string,"presentation_label"?: string,"product_id"?: string,"profit"?: number,"qty"?: number,"sale_id"?: string,"sku"?: string,"subtotal"?: number,"total_cost"?: number,"unit_cost"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_presentation_id_fkey"
      columns: ["presentation_id"]
isOneToOne: false
      referencedRelation: "product_presentations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "sale_items_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"payment_method_id": string,"reference": string | null,"sale_id": string,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"payment_method_id": string,"reference"?: string | null,"sale_id": string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"payment_method_id"?: string,"reference"?: string | null,"sale_id"?: string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_payments_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_return_items": {
                  Row: {
                    "base_qty": number,"id": string,"product_id": string,"qty": number,"return_id": string,"sale_item_id": string,"subtotal": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_qty": number,"id"?: string,"product_id": string,"qty": number,"return_id": string,"sale_item_id": string,"subtotal"?: number,"unit_price"?: number
                  }
                  Update: {
                    "base_qty"?: number,"id"?: string,"product_id"?: string,"qty"?: number,"return_id"?: string,"sale_item_id"?: string,"subtotal"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_return_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_return_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "sale_return_items_return_id_fkey"
      columns: ["return_id"]
isOneToOne: false
      referencedRelation: "sale_returns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_return_items_sale_item_id_fkey"
      columns: ["sale_item_id"]
isOneToOne: false
      referencedRelation: "sale_items"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_returns": {
                  Row: {
                    "code": string,"created_at": string,"customer_id": string | null,"date": string,"id": string,"reason": string,"sale_id": string,"status": Database["public"]['Enums']["return_status"],"total": number,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"customer_id"?: string | null,"date"?: string,"id"?: string,"reason"?: string,"sale_id": string,"status"?: Database["public"]['Enums']["return_status"],"total"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"customer_id"?: string | null,"date"?: string,"id"?: string,"reason"?: string,"sale_id"?: string,"status"?: Database["public"]['Enums']["return_status"],"total"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_returns_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_returns_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_returns_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "cash_register_id": string | null,"cash_session_id": string | null,"code": string,"created_at": string,"customer_doc": string,"customer_id": string | null,"customer_name": string,"date": string,"deleted_at": string | null,"discount": number,"doc_type": Database["public"]['Enums']["document_type"],"id": string,"notes": string | null,"number": string,"profit": number,"series": string,"status": Database["public"]['Enums']["sale_status"],"subtotal": number,"tax": number,"total": number,"updated_at": string,"user_id": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cash_register_id"?: string | null,"cash_session_id"?: string | null,"code": string,"created_at"?: string,"customer_doc"?: string,"customer_id"?: string | null,"customer_name"?: string,"date"?: string,"deleted_at"?: string | null,"discount"?: number,"doc_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"notes"?: string | null,"number": string,"profit"?: number,"series": string,"status"?: Database["public"]['Enums']["sale_status"],"subtotal"?: number,"tax"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "cash_register_id"?: string | null,"cash_session_id"?: string | null,"code"?: string,"created_at"?: string,"customer_doc"?: string,"customer_id"?: string | null,"customer_name"?: string,"date"?: string,"deleted_at"?: string | null,"discount"?: number,"doc_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"notes"?: string | null,"number"?: string,"profit"?: number,"series"?: string,"status"?: Database["public"]['Enums']["sale_status"],"subtotal"?: number,"tax"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_cash_register_id_fkey"
      columns: ["cash_register_id"]
isOneToOne: false
      referencedRelation: "cash_registers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_cash_session_id_fkey"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_cash_session_id_fkey"
      columns: ["cash_session_id"]
isOneToOne: false
      referencedRelation: "v_cash_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "sales_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "sales_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_adjustments": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"id": string,"product_id": string,"qty": number,"reason": string,"status": Database["public"]['Enums']["adjustment_status"],"user_id": string | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"product_id": string,"qty": number,"reason"?: string,"status"?: Database["public"]['Enums']["adjustment_status"],"user_id"?: string | null,"warehouse_id": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"product_id"?: string,"qty"?: number,"reason"?: string,"status"?: Database["public"]['Enums']["adjustment_status"],"user_id"?: string | null,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustments_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "stock_adjustments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_inventory_valuation"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_adjustments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["warehouse_id"]
    },{
      foreignKeyName: "stock_adjustments_warehouse_id_fkey"
      columns: ["warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "active": boolean,"address": string,"category": string,"contact": string,"created_at": string,"deleted_at": string | null,"email": string,"id": string,"name": string,"phone": string,"rating": number,"ruc": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string,"category"?: string,"contact"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string,"id"?: string,"name": string,"phone"?: string,"rating"?: number,"ruc"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string,"category"?: string,"contact"?: string,"created_at"?: string,"deleted_at"?: string | null,"email"?: string,"id"?: string,"name"?: string,"phone"?: string,"rating"?: number,"ruc"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"units": {
                  Row: {
                    "base_unit": Database["public"]['Enums']["base_unit"] | null,"code": string,"created_at": string,"factor": number,"kind": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_unit"?: Database["public"]['Enums']["base_unit"] | null,"code": string,"created_at"?: string,"factor"?: number,"kind": string,"name": string
                  }
                  Update: {
                    "base_unit"?: Database["public"]['Enums']["base_unit"] | null,"code"?: string,"created_at"?: string,"factor"?: number,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"warehouses": {
                  Row: {
                    "active": boolean,"address": string,"code": string,"created_at": string,"deleted_at": string | null,"id": string,"is_default": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string,"code": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_default"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_default"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_cash_sessions": {
                  Row: {
                    "cash_register_id": string,"cashier_name": string | null,"closed_at": string | null,"counted_total": number | null,"difference": number | null,"expected_total": number,"expenses_total": number,"id": string,"opened_at": string,"opening_amount": number,"register_code": string,"register_name": string,"sales_total": number,"status": Database["public"]['Enums']["cash_session_status"],"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "cash_sessions_cash_register_id_fkey"
      columns: ["cash_register_id"]
isOneToOne: false
      referencedRelation: "cash_registers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"v_cashier_performance": {
                  Row: {
                    "avg_ticket": number | null,"cashier_name": string | null,"last_sale_at": string | null,"profit": number | null,"sales_count": number | null,"total": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"v_daily_sales": {
                  Row: {
                    "avg_ticket": number | null,"day": string | null,"profit": number | null,"sales_count": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_expenses_summary": {
                  Row: {
                    "category_id": string | null,"category_name": string | null,"expense_count": number | null,"last_expense_at": string | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"v_inventory_valuation": {
                  Row: {
                    "cost_value": number | null,"products_count": number | null,"retail_value": number | null,"total_stock": number | null,"warehouse_id": string,"warehouse_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_low_stock": {
                  Row: {
                    "base_unit": Database["public"]['Enums']["base_unit"],"min_stock": number,"missing_qty": number | null,"name": string,"product_id": string,"sku": string,"status": string | null,"stock": number,"warehouse_id": string,"warehouse_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_monthly_sales": {
                  Row: {
                    "avg_ticket": number | null,"month": string | null,"profit": number | null,"sales_count": number | null,"tax": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_purchases_summary": {
                  Row: {
                    "last_purchase_at": string | null,"orders_count": number | null,"pending_count": number | null,"supplier_id": string,"supplier_name": string | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"v_sales_daily_profit": {
                  Row: {
                    "day": string | null,"profit": number | null,"revenue": number | null,"voided": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_top_products": {
                  Row: {
                    "base_qty": number | null,"name": string,"presentation_qty": number | null,"product_id": string,"profit": number | null,"revenue": number | null,"sales_count": number | null,"sku": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "v_low_stock"
      referencedColumns: ["product_id"]
    }
                  ]
                }
          }
          Functions: {
            "approve_sale_return":
{ Args: { "p_approve": boolean,"p_return_id": string }; Returns: Json
                           },
"assert_permission":
{ Args: { "p_action": string,"p_module": string }; Returns: undefined
                           },
"can_view_cash_session":
{ Args: { "p_session_id": string }; Returns: boolean
                           },
"can_view_sale":
{ Args: { "p_sale_id": string }; Returns: boolean
                           },
"close_cash_session":
{ Args: { "p_cash_session_id": string,"p_counted_total": number,"p_notes"?: string }; Returns: Json
                           },
"create_purchase":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"create_purchase_return":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"create_sale":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"create_sale_return":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"create_stock_adjustment":
{ Args: { "p_product_id": string,"p_qty": number,"p_reason": string,"p_warehouse_id"?: string }; Returns: Json
                           },
"current_role_code":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"default_warehouse_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"has_permission":
{ Args: { "p_action": string,"p_module": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_audit":
{ Args: { "p_action": string,"p_entity": string,"p_entity_id"?: string,"p_new_data"?: Json,"p_old_data"?: Json }; Returns: undefined
                           },
"next_document_number":
{ Args: { "p_doc_type": Database["public"]['Enums']["document_type"],"p_series"?: string }; Returns: {
              "code": string,"number": string,"series": string
            }[]
                           },
"open_cash_session":
{ Args: { "p_cash_register_id": string,"p_opening_amount": number }; Returns: Json
                           },
"p_open_amount_or_default":
{ Args: { "p_amount": number }; Returns: number
                           },
"receive_purchase":
{ Args: { "p_purchase_id": string }; Returns: Json
                           },
"record_expense":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"register_cash_movement":
{ Args: { "p_amount": number,"p_cash_session_id": string,"p_description"?: string,"p_type": Database["public"]['Enums']["cash_movement_type"] }; Returns: Json
                           },
"register_login":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_demo_history":
{ Args: { "p_count"?: number,"p_days"?: number,"p_user_id": string }; Returns: Json
                           },
"seed_open_cash_session":
{ Args: { "p_opening_amount"?: number,"p_register_code"?: string,"p_user_id": string }; Returns: Json
                           },
"void_purchase":
{ Args: { "p_purchase_id": string,"p_reason"?: string }; Returns: Json
                           },
"void_sale":
{ Args: { "p_reason"?: string,"p_sale_id": string }; Returns: Json
                           }
          }
          Enums: {
            "adjustment_status": "pendiente"|"aprobado"|"rechazado","app_role": "administrador"|"gerente"|"supervisor"|"cajero"|"almacenero","base_unit": "und"|"kg"|"lt"|"ml"|"g","cash_movement_type": "apertura"|"venta"|"ingreso"|"retiro"|"gasto"|"ajuste"|"cierre","cash_session_status": "abierta"|"cerrada","customer_segment": "minorista"|"mayorista"|"corporativo","document_type": "boleta"|"factura"|"nota_credito"|"nota_debito"|"guia","identity_doc_type": "DNI"|"RUC"|"CE"|"PASAPORTE","movement_type": "entrada"|"salida"|"ajuste"|"devolucion","payment_status": "pendiente"|"completado"|"rechazado","purchase_status": "pendiente"|"parcial"|"recibida"|"anulada","purchase_unit": "caja"|"saco"|"bolsa"|"paquete","return_status": "pendiente"|"aprobada"|"rechazada","sale_status": "pagada"|"anulada"|"devuelta"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "adjustment_status": ["pendiente", "aprobado", "rechazado"],"app_role": ["administrador", "gerente", "supervisor", "cajero", "almacenero"],"base_unit": ["und", "kg", "lt", "ml", "g"],"cash_movement_type": ["apertura", "venta", "ingreso", "retiro", "gasto", "ajuste", "cierre"],"cash_session_status": ["abierta", "cerrada"],"customer_segment": ["minorista", "mayorista", "corporativo"],"document_type": ["boleta", "factura", "nota_credito", "nota_debito", "guia"],"identity_doc_type": ["DNI", "RUC", "CE", "PASAPORTE"],"movement_type": ["entrada", "salida", "ajuste", "devolucion"],"payment_status": ["pendiente", "completado", "rechazado"],"purchase_status": ["pendiente", "parcial", "recibida", "anulada"],"purchase_unit": ["caja", "saco", "bolsa", "paquete"],"return_status": ["pendiente", "aprobada", "rechazada"],"sale_status": ["pagada", "anulada", "devuelta"]
          }
        }
} as const
