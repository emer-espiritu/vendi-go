-- Publica en Realtime solo las tablas que la app escucha.
--
-- Supabase crea la publicación `supabase_realtime` vacía (puballtables = false):
-- sin `alter publication` el canal conecta pero nunca llega un evento y las
-- pantallas de otros usuarios no se refrescan. El bloque es idempotente para
-- poder reaplicarse sin duplicar tablas.
do $$
declare
  target text;
  targets text[] := array[
    'products',
    'product_presentations',
    'inventory',
    'inventory_movements',
    'sales',
    'sale_returns',
    'cash_sessions',
    'cash_movements',
    'purchase_orders',
    'expenses',
    'customers'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach target in array targets loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;
