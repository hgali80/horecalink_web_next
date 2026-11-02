// No automatic retries for requests which can create an external publication.
export async function metaRequest(resource, { method = 'GET', params = {}, token = process.env.META_SOCIAL_ACCESS_TOKEN } = {}) {
  const version = process.env.META_SOCIAL_GRAPH_API_VERSION || 'v26.0';
  if (!/^v\d+\.\d+$/.test(version) || !token || !/^\d+(?:\/(?:media|media_publish|photos|feed))?$/.test(resource)) throw new Error('SOCIAL_CONFIGURATION_MISSING');
  const url = new URL(`https://graph.facebook.com/${version}/${resource}`);
  const values = new URLSearchParams(params);
  if (method === 'GET') url.search = values.toString();
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(method === 'POST' ? { body: values } : {}), redirect: 'error', signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`META_${Number(data.error?.code) || response.status}`);
  return data;
}
export async function publishSocial(job, caption, images, saveContainer, saveProgress = async () => {}) {
  const urls = Array.isArray(images) ? images : [images];
  if (!urls.length || urls.length > 10 || urls.some(url => !url)) throw new Error('INVALID_SOCIAL_IMAGES');
  if (job.channel === 'facebook') {
    const page = process.env.META_SOCIAL_PAGE_ID;
    const access = await metaRequest(page, { params: { fields: 'access_token' } });
    if (!access.access_token) throw new Error('PAGE_TOKEN_UNAVAILABLE');
    let result;
    if (urls.length === 1) {
      result = await metaRequest(`${page}/photos`, { method: 'POST', token: access.access_token, params: { url: urls[0], caption, published: 'true' } });
    } else {
      const photoIds = [...(job.photoIds || [])];
      for (let i = photoIds.length; i < urls.length; i++) {
        const photo = await metaRequest(`${page}/photos`, { method: 'POST', token: access.access_token, params: { url: urls[i], published: 'false' } });
        if (!photo.id) throw new Error('PHOTO_RESULT_UNKNOWN');
        photoIds.push(photo.id);
        await saveProgress({ photoIds: [...photoIds] });
      }
      result = await metaRequest(`${page}/feed`, { method: 'POST', token: access.access_token, params: { message: caption, attached_media: JSON.stringify(photoIds.map(id => ({ media_fbid: id }))) } });
    }
    if (!result.id) throw new Error('PUBLICATION_RESULT_UNKNOWN');
    return { status: 'published', remoteId: result.post_id || result.id };
  }
  const account = process.env.META_SOCIAL_INSTAGRAM_ID;
  if (!job.containerId) {
    let params = { image_url: urls[0], caption };
    if (urls.length > 1) {
      const childIds = [...(job.childContainerIds || [])];
      for (let i = childIds.length; i < urls.length; i++) {
        const child = await metaRequest(`${account}/media`, { method: 'POST', params: { image_url: urls[i], is_carousel_item: 'true' } });
        if (!child.id) throw new Error('CONTAINER_RESULT_UNKNOWN');
        childIds.push(child.id);
        await saveProgress({ childContainerIds: [...childIds] });
      }
      let pending = false;
      for (const id of childIds) {
        const child = await metaRequest(id, { params: { fields: 'status_code' } });
        if (child.status_code === 'IN_PROGRESS' && job.attempts < 20) pending = true;
        else if (child.status_code !== 'FINISHED') throw new Error('INSTAGRAM_CHILD_REQUIRES_REVIEW');
      }
      if (pending) return { status: 'queued', nextAttemptAt: Date.now() + 60000 };
      params = { media_type: 'CAROUSEL', children: childIds.join(','), caption };
    }
    const container = await metaRequest(`${account}/media`, { method: 'POST', params });
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
