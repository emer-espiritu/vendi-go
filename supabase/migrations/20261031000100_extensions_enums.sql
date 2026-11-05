-- =============================================================================
-- VendiGo · 0001 · Extensiones, enums y utilidades comunes
-- =============================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('administrador', 'gerente', 'supervisor', 'cajero', 'almacenero');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.base_unit as enum ('und', 'kg', 'lt', 'ml', 'g');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.purchase_unit as enum ('caja', 'saco', 'bolsa', 'paquete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('entrada', 'salida', 'ajuste', 'devolucion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.purchase_status as enum ('pendiente', 'parcial', 'recibida', 'anulada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sale_status as enum ('pagada', 'anulada', 'devuelta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.return_status as enum ('pendiente', 'aprobada', 'rechazada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_session_status as enum ('abierta', 'cerrada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_movement_type as enum ('apertura', 'venta', 'ingreso', 'retiro', 'gasto', 'ajuste', 'cierre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('boleta', 'factura', 'nota_credito', 'nota_debito', 'guia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.customer_segment as enum ('minorista', 'mayorista', 'corporativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_doc_type as enum ('DNI', 'RUC', 'CE', 'PASAPORTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pendiente', 'completado', 'rechazado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.adjustment_status as enum ('pendiente', 'aprobado', 'rechazado');
exception when duplicate_object then null; end $$;

-- Trigger genérico para updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Secuencias globales para códigos legibles.
create sequence if not exists public.purchase_order_seq start 1;
create sequence if not exists public.expense_code_seq start 1;
create sequence if not exists public.sale_return_seq start 1;
create sequence if not exists public.purchase_return_seq start 1;
