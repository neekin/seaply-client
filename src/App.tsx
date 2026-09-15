import { useEffect, useRef, useState } from 'react'
import { App as AntApp, Button, Empty, Layout, Typography } from 'antd'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { api, getToken, setToken } from './api'
import type { ChatMessage, Conversation, LoginUser } from './types'
import LoginView from './components/LoginView'
import ConversationList from './components/ConversationList'
import ChatPanel from './components/ChatPanel'

const HEARTBEAT_MS = 30_000 // 桌面在线心跳（Presence 窗口 60s）
const POLL_MS = 3_000 // 会话/消息轮询（后续可替换为 WebSocket 推送）

// 桌面通知：非 Tauri 环境（浏览器 dev）静默降级
async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      const perm = await requestPermission()
      granted = perm === 'granted'
    }
    if (granted) sendNotification({ title, body })
  } catch {
    /* 忽略：非 Tauri 环境或不支持通知 */
  }
}

async function requestNotifyPermission(): Promise<void> {
  try {
    if (!(await isPermissionGranted())) await requestPermission()
  } catch {
    /* 忽略 */
  }
}


function loadUser(): LoginUser | null {
  const raw = localStorage.getItem('seaply:user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginUser
  } catch {
    return null
  }
}

export default function App() {
  const { message: feedback } = AntApp.useApp()
  const [user, setUser] = useState<LoginUser | null>(loadUser)
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const prevUnread = useRef<Record<number, number>>({}) // 各会话上次 unread_count，用于增量检测
  const seenIds = useRef<Set<number>>(new Set()) // 已见消息 id，用于活跃会话新 inbound 检测
  const activeIdRef = useRef<number | null>(null)
  activeIdRef.current = activeId

  const activeConv = conversations.find((c) => c.id === activeId) ?? null

  // 会话列表轮询
  useEffect(() => {
    if (!authed) return
    let alive = true
    const load = async () => {
      try {
        const list = await api.conversations()
        if (!alive) return
        setConversations(list)
        // 非活跃会话未读数增加 → 新访客消息，弹桌面通知
        list.forEach((c) => {
          const prev = prevUnread.current[c.id]
          if (prev !== undefined && c.unread_count > prev && c.id !== activeIdRef.current) {
            void notify(c.visitor_name, '发来新消息')
          }
          prevUnread.current[c.id] = c.unread_count
        })
        setActiveId((prev) => (prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null)))
      } catch (e) {
        if (alive) feedback.error((e as Error).message)
      }
    }
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [authed, feedback])

  // 消息轮询 + 打开会话即标记已读
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let alive = true
    const load = async () => {
      try {
        const list = await api.messages(activeId)
        if (!alive) return
        setMessages(list)
        // 活跃会话新 inbound 且窗口隐藏（未在看）→ 弹通知提醒
        const hidden = typeof document !== 'undefined' && document.hidden
        list.forEach((m) => {
          if (m.direction === 'inbound' && !seenIds.current.has(m.id) && hidden) {
            void notify(activeConv?.visitor_name ?? '访客', m.body_translated || m.body_original || '')
          }
          seenIds.current.add(m.id)
        })
        await api.markRead(activeId)
      } catch {
        /* 轮询失败静默，等下个周期 */
      }
    }
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [activeId])

  // 桌面在线心跳：登录期间持续打点，使该席位的 AI 托管让位
  useEffect(() => {
    if (!authed) return
    const beat = () => {
      void api.heartbeat().catch(() => {})
    }
    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [authed])

  const handleLogin = (u: LoginUser) => {
    localStorage.setItem('seaply:user', JSON.stringify(u))
    setUser(u)
    setAuthed(true)
    void requestNotifyPermission()
  }

  const handleLogout = async () => {
    // 主动下线：立即移除心跳，让 AI 立刻恢复接管，不必等 60s 过期
    try {
      await api.offline()
    } catch {
      /* 忽略：令牌可能已失效 */
    }
    setToken(null)
    localStorage.removeItem('seaply:user')
    setUser(null)
    setAuthed(false)
    setConversations([])
    setMessages([])
    setActiveId(null)
  }

  if (!authed) return <LoginView onSuccess={handleLogin} />

  return (
    <Layout style={{ height: '100%' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderBottom: '1px solid #eee',
          paddingInline: 16,
        }}
      >
        <Typography.Text strong>Seaply 客服工作台</Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {user ? `${user.name}` : ''}
          </Typography.Text>
          <Button size="small" onClick={() => void handleLogout()}>
            退出
          </Button>
        </div>
      </Layout.Header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => setActiveId(id)}
        />
        {activeConv ? (
          <ChatPanel
            key={activeConv.id}
            conversation={activeConv}
            messages={messages}
            onSent={(m) => setMessages((prev) => [...prev, m])}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="选择左侧会话开始聊天" />
          </div>
        )}
      </div>
    </Layout>
  )
}
