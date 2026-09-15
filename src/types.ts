export type ChatMessage = {
  id: number
  direction: 'inbound' | 'outbound'
  msg_type: string
  body_original: string | null
  body_translated: string | null
  status: string
  created_at?: string
  seq?: number
  media_url?: string | null
  generated_by?: string
}

export type Conversation = {
  id: number
  status: string
  visitor_name: string
  visitor_locale: string
  channel: string
  unread_count: number
  last_message_at: string | null
  assigned_user_id: number | null
  ai_paused: boolean
  ai_handoff: boolean
}

export type LoginUser = {
  id: number
  name: string
  email: string | null
  role: string
  ai_hosted: boolean
}

export type LoginResponse = {
  token: string
  user: LoginUser
  tenant: { id: number; name: string | null }
}

// 话术库条目（按 category 分组返回）
export type CannedResponse = {
  id: number
  title: string
  content: string
  category: string | null
}

// 媒体库条目；url 为图片缩略图（仅 image 有值），video/file 用 kind 决定展示图标
export type MediaAsset = {
  id: number
  kind: string
  name: string
  size: string | null
  url: string | null
  created_at: string | null
}
