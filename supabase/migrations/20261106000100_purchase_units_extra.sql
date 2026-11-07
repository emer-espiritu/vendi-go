-- Additional packaging units used by the catalog.
-- Additive only: existing products keep their current purchase unit.

alter type public.purchase_unit add value if not exists 'plancha';
alter type public.purchase_unit add value if not exists 'tira';
alter type public.purchase_unit add value if not exists 'display';
