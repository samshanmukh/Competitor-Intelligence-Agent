import insforge from './index.js';

// One TAM/SAM/SOM model per workspace (upserted).
export async function getMarketModel(workspaceId) {
  const { data } = await insforge.database
    .from('market_models')
    .select()
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data ? data.data : null;
}

export async function saveMarketModel(workspaceId, productId, model) {
  const existing = await insforge.database
    .from('market_models')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const row = {
    workspace_id: workspaceId,
    product_id: productId || null,
    data: model,
    updated_at: new Date().toISOString(),
  };

  if (existing.data) {
    await insforge.database.from('market_models').update(row).eq('workspace_id', workspaceId);
  } else {
    await insforge.database.from('market_models').insert(row);
  }
  return model;
}

// Append an immutable snapshot each time a model is (re)built, for change tracking.
export async function insertModelHistory(workspaceId, productId, model) {
  await insforge.database
    .from('market_model_history')
    .insert({ workspace_id: workspaceId, product_id: productId || null, data: model });
}

// Compact history for the "what changed" view (latest first).
export async function getModelHistory(workspaceId, limit = 6) {
  const { data } = await insforge.database
    .from('market_model_history')
    .select('data, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).map((r) => ({
    created_at: r.created_at,
    tam: r.data?.tam?.value_usd ?? null,
    sam: r.data?.sam?.value_usd ?? null,
    som: r.data?.som?.value_usd ?? null,
    geography: r.data?.inputs?.geography ?? null,
  }));
}
