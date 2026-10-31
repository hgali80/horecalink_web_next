// No automatic retries for requests which can create an external publication.
export async function metaRequest(resource, { method = 'GET', params = {}, token = process.env.META_SOCIAL_ACCESS_TOKEN } = {}) {
  const version = process.env.META_SOCIAL_GRAPH_API_VERSION || 'v26.0';
  if (!/^v\d+\.\d+$/.test(version) || !token || !/^\d+(?:\/(?:media|media_publish|photos))?$/.test(resource)) throw new Error('SOCIAL_CONFIGURATION_MISSING');
  const url = new URL(`https://graph.facebook.com/${version}/${resource}`);
  const values = new URLSearchParams(params);
  if (method === 'GET') url.search = values.toString();
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(method === 'POST' ? { body: values } : {}), redirect: 'error', signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`META_${Number(data.error?.code) || response.status}`);
  return data;
}
export async function publishSocial(job, caption, imageUrl, saveContainer) {
  if (job.channel === 'facebook') {
    const page = process.env.META_SOCIAL_PAGE_ID;
    const access = await metaRequest(page, { params: { fields: 'access_token' } });
    if (!access.access_token) throw new Error('PAGE_TOKEN_UNAVAILABLE');
    const result = await metaRequest(`${page}/photos`, { method: 'POST', token: access.access_token, params: { url: imageUrl, caption, published: 'true' } });
    if (!result.id) throw new Error('PUBLICATION_RESULT_UNKNOWN');
    return { status: 'published', remoteId: result.post_id || result.id };
  }
  const account = process.env.META_SOCIAL_INSTAGRAM_ID;
  if (!job.containerId) {
    const container = await metaRequest(`${account}/media`, { method: 'POST', params: { image_url: imageUrl, caption } });
    if (!container.id) throw new Error('CONTAINER_RESULT_UNKNOWN');
    await saveContainer(container.id);
    return { status: 'queued', nextAttemptAt: Date.now() + 60000 };
  }
  const state = await metaRequest(job.containerId, { params: { fields: 'status_code' } });
  if (state.status_code === 'IN_PROGRESS' && job.attempts < 20) return { status: 'queued', nextAttemptAt: Date.now() + 60000 };
  if (state.status_code !== 'FINISHED') throw new Error('INSTAGRAM_CONTAINER_REQUIRES_REVIEW');
  const result = await metaRequest(`${account}/media_publish`, { method: 'POST', params: { creation_id: job.containerId } });
  if (!result.id) throw new Error('PUBLICATION_RESULT_UNKNOWN');
  return { status: 'published', remoteId: result.id };
}
