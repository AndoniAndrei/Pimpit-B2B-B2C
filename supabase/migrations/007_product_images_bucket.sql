-- Create public storage bucket for product images (zip-imported)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,  -- 10 MB per file
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Public read policy
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Service role write policy (import runs with service role)
create policy "Service role upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');
