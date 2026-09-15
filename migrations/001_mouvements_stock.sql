create table if not exists mouvements_stock (
  id bigint generated always as identity primary key,
  ingredient_id bigint not null references ingredients(id),
  quantite numeric not null,
  motif text not null,
  created_at timestamptz not null default now()
);
