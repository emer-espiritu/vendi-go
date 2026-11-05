-- =============================================================================
-- VendiGo · 0014 · Sincronización bidireccional del precio base
--
-- `product_presentations` con `is_base = true` es la fuente de verdad para el
-- precio de la unidad base en el POS (así lo resuelve `create_sale`), mientras
-- que `products.price` se usa en listados y reportes. El trigger existente
-- propaga presentación base → producto. Este trigger cubre el sentido inverso
-- para que una actualización directa de `products.price` no deje la
-- presentación base desactualizada.
--
-- El `when` evita la recursión: la escritura de vuelta de la presentación deja
-- `products.price` con el mismo valor, por lo que el trigger no vuelve a
-- dispararse.
-- =============================================================================

create or replace function public.sync_product_base_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.product_presentations
     set price = new.price
   where product_id = new.id
     and is_base
     and price is distinct from new.price;

  return new;
end;
$$;

drop trigger if exists products_sync_base_presentation on public.products;
create trigger products_sync_base_presentation
after update of price on public.products
for each row
when (old.price is distinct from new.price)
execute function public.sync_product_base_price();
