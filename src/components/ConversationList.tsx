import { Badge, Empty, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { Conversation } from '../types'

function initials(name: string): string {
  const t = name?.trim()
  return t ? t.slice(0, 1).toUpperCase() : '?'
}

type Props = {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (id: number) => void
}

export default function ConversationList({ conversations, activeId, onSelect }: Props) {
  const unread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div className="conv">
      <div className="conv__brand">
        <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
          <rect width="32" height="32" rx="9" fill="#fff" />
          <path
            d="M9 13a5.5 5.5 0 0 1 5.5-5.5h3A5.5 5.5 0 0 1 23 13v3.5a5.5 5.5 0 0 1-5.5 5.5H14l-4 3v-3h-.5A5.5 5.5 0 0 1 9 16.5V13z"
            fill="url(#clg)"
          />
          <defs>
            <linearGradient id="clg" x1="9" y1="7" x2="23" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4c6ef5" />
              <stop offset="1" stopColor="#3b5bdb" />
            </linearGradient>
          </defs>
        </svg>
        <span className="conv__title">会话</span>
        {unread > 0 ? <Badge count={unread} style={{ marginLeft: 4 }} /> : null}
      </div>

      <div className="conv__search">
        <Input prefix={<SearchOutlined />} placeholder="搜索会话" size="small" variant="filled" />
      </div>

      <div className="conv__list">
        {conversations.length === 0 ? (
          <Empty description="暂无会话" style={{ marginTop: 40 }} />
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`conv-item${c.id === activeId ? ' conv-item--active' : ''}`}
            >
              <div className={`conv-avatar${c.channel === 'whatsapp' ? ' conv-avatar--wa' : ''}`}>
                {initials(c.visitor_name)}
              </div>
              <div className="conv-body">
                <div className="conv-row">
                  <span className="conv-name">{c.visitor_name}</span>
                  <span className="conv-time">
                    {c.last_message_at
                      ? new Date(c.last_message_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
                <div className="conv-snippet">
                  <span className="conv-pill">{c.channel === 'whatsapp' ? 'WA' : 'WEB'}</span>
                  {c.last_message_preview || '暂无消息'}
                </div>
              </div>
              {c.unread_count > 0 ? <Badge count={c.unread_count} /> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
