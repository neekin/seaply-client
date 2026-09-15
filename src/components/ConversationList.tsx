import { Badge, Empty, Tag, Typography } from 'antd'
import type { Conversation } from '../types'

type Props = {
  conversations: Conversation[]
  activeId: number | null
  onSelect: (id: number) => void
}

export default function ConversationList({ conversations, activeId, onSelect }: Props) {
  const unread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderInlineEnd: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: 12,
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography.Text strong>会话</Typography.Text>
        {unread > 0 ? <Badge count={unread} style={{ marginInlineStart: 8 }} /> : null}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <Empty description="暂无会话" style={{ marginTop: 40 }} />
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                background: c.id === activeId ? '#e6f4ff' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text style={{ fontSize: 13 }} ellipsis>
                  {c.visitor_name}
                </Typography.Text>
                {c.unread_count > 0 ? <Badge count={c.unread_count} /> : null}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                <Tag style={{ marginInlineEnd: 4, fontSize: 11 }}>
                  {c.channel === 'whatsapp' ? 'WhatsApp' : '网页'}
                </Tag>
                {c.last_message_at
                  ? new Date(c.last_message_at).toLocaleString('zh-CN', { hour12: false })
                  : '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
