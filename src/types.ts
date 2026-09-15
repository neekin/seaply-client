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
