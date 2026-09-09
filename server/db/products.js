import databaseClient from './index.js';

// Each workspace has a single primary "my product" profile (the first row).
export async function getProduct(workspaceId) {
  const { data } = await databaseClient.database
    .from('products')
    .select()
    .eq('workspace_id', workspaceId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function upsertProduct(workspaceId, { name, description, pricing_url, logo_url, pricing_data }) {
  const existing = await getProduct(workspaceId);
  const payload = {
    name: name ?? existing?.name ?? 'My Product',
    description: description ?? existing?.description ?? null,
    pricing_url: pricing_url ?? existing?.pricing_url ?? null,
    logo_url: logo_url ?? existing?.logo_url ?? null,
    pricing_data: pricing_data ?? existing?.pricing_data ?? null,
  };

  if (existing) {
    const { data } = await databaseClient.database
      .from('products')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    return data;
  }

  const { data } = await databaseClient.database
    .from('products')
    .insert({ workspace_id: workspaceId, ...payload })
    .select()
    .maybeSingle();
  return data;
}
