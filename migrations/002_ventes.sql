create table if not exists ventes (
  id bigint generated always as identity primary key,
  plat_id bigint not null references plats(id),
  created_at timestamptz not null default now()
);
