import type { ChatMessage, Conversation, LoginResponse, CannedResponse, MediaAsset } from './types'

const BASE_KEY = 'seaply:base_url'
const TOKEN_KEY = 'seaply:token'

export const DEFAULT_BASE_URL = 'https://shenqihailuo.com'

export function getBaseUrl(): string {
  return localStorage.getItem(BASE_KEY) || DEFAULT_BASE_URL
}

export function setBaseUrl(url: string): void {
  localStorage.setItem(BASE_KEY, url.trim().replace(/\/+$/, ''))
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    })
  } catch (e) {
    throw new Error(`网络请求失败：${(e as Error).message}`)
  }

  if (res.status === 401) {
    // 令牌失效：清空并交给上层重新登录
    setToken(null)
    throw new Error('登录已失效，请重新登录')
  }
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      /* 响应非 JSON 时沿用默认提示 */
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export const api = {
  login: async (account: string, password: string) => {
    const res = await request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    })
    setToken(res.token)
    return res
  },

  conversations: () => request<Conversation[]>('/api/v1/conversations'),

  messages: (conversationId: number) =>
    request<ChatMessage[]>(`/api/v1/conversations/${conversationId}/messages`),

  send: (
    conversationId: number,
    body: string,
    opts?: { preTranslated?: string; targetLocale?: string; mediaAssetId?: number; caption?: string },
  ) => {
    const payload: Record<string, unknown> = {}
    if (opts?.mediaAssetId) {
      payload.media_asset_id = opts.mediaAssetId
      const caption = (opts.caption ?? body).trim()
      if (caption) payload.caption = caption
    } else {
      payload.body = body
      if (opts?.preTranslated) {
        payload.pre_translated = opts.preTranslated
        payload.target_locale = opts.targetLocale
      }
    }
    return request<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // 话术库（按分类分组：{ 分类: CannedResponse[] }）；客户端只读选用
  cannedResponses: () => request<Record<string, CannedResponse[]>>('/api/v1/canned_responses'),

  // 媒体库列表；客户端只读选用 + 发送（media_asset_id 直发）
  mediaAssets: () => request<MediaAsset[]>('/api/v1/media_assets'),

  // 边写边译预览：同步返回译文，不落库、不发送
  translatePreview: (conversationId: number, text: string, targetLocale: string) =>
    request<{ translated: string; target_locale: string }>(
      `/api/v1/conversations/${conversationId}/translate_preview`,
      { method: 'POST', body: JSON.stringify({ text, target_locale: targetLocale }) },
    ),

  markRead: (conversationId: number) =>
    request<{ ok: boolean }>(`/api/v1/conversations/${conversationId}/mark_read`, { method: 'POST' }),

  // 桌面在线心跳：登录后定期打点，使 AI 托管临时让位；退出时调 offline 立即恢复
  heartbeat: () => request<{ ok: boolean }>('/api/v1/presence/heartbeat', { method: 'POST' }),
  offline: () => request<{ ok: boolean }>('/api/v1/presence/offline', { method: 'POST' }),
}
