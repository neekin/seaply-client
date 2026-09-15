import { useEffect, useRef, useState } from 'react'
import { App as AntApp, Button, Empty, Input, Tag, Typography, Switch, Spin } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { api } from '../api'
import type { ChatMessage, Conversation } from '../types'

type Props = {
  conversation: Conversation
  messages: ChatMessage[]
  onSent: (msg: ChatMessage) => void
}

// 气泡：坐席视角——自己发的看原文（下方灰字是发给访客的译文），访客消息看译文
function Bubble({ m }: { m: ChatMessage }) {
  const outbound = m.direction === 'outbound'
  const primary = outbound ? m.body_original : (m.body_translated ?? m.body_original ?? '…')
  const secondary = outbound ? m.body_translated : m.body_translated ? m.body_original : null
  const time = m.created_at
    ? new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ alignSelf: outbound ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderRadius: outbound ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: outbound ? '#d9fdd3' : '#fff',
          color: '#1a1a1a',
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <div>{primary}</div>
        {secondary && secondary !== primary ? (
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{secondary}</div>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#999',
          margin: '2px 4px 0',
          textAlign: outbound ? 'right' : 'left',
        }}
      >
        {time}
        {m.generated_by === 'ai' ? ' · AI' : ''}
      </div>
    </div>
  )
}

export default function ChatPanel({ conversation, messages, onSent }: Props) {
  const { message: feedback } = AntApp.useApp()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [liveTranslate, setLiveTranslate] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const previewTimer = useRef<number | null>(null)
  const lastPreviewed = useRef<string>('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, conversation.id])

  // 边写边译：开启后，输入框内容变化即防抖请求译文预览（target 默认访客语言）
  useEffect(() => {
    if (!liveTranslate) {
      setPreview(null)
      return
    }
    const t = text.trim()
    if (!t) {
      setPreview(null)
      lastPreviewed.current = ''
      return
    }
    if (t === lastPreviewed.current) return
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(async () => {
      lastPreviewed.current = t
      setPreviewing(true)
      try {
        const res = await api.translatePreview(conversation.id, t, conversation.visitor_locale || 'en')
        if (lastPreviewed.current === t) setPreview(res.translated)
      } catch {
        /* 预览失败静默，不阻断输入 */
      } finally {
        setPreviewing(false)
      }
    }, 500)
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current)
    }
  }, [text, liveTranslate, conversation.id, conversation.visitor_locale])

  // 乐观发送：先清空输入框，失败再把内容还回来
  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setText('')
    setSending(true)
    const opts =
      liveTranslate && preview
        ? { preTranslated: preview, targetLocale: conversation.visitor_locale }
        : undefined
    try {
      onSent(await api.send(conversation.id, body, opts))
      setPreview(null)
      lastPreviewed.current = ''
    } catch (e) {
      setText(body)
      feedback.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Typography.Text strong>{conversation.visitor_name}</Typography.Text>
        <Tag>{conversation.channel === 'whatsapp' ? 'WhatsApp' : '网页聊天'}</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {conversation.visitor_locale}
        </Typography.Text>
        {conversation.ai_handoff ? <Tag color="gold">已转人工</Tag> : null}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            边写边译
          </Typography.Text>
          <Switch size="small" checked={liveTranslate} onChange={setLiveTranslate} />
        </span>
      </div>

      <div
        ref={listRef}
        className="msg-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: '#f7f8fa',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <Empty description="暂无消息" style={{ margin: 'auto' }} />
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      <div style={{ flexShrink: 0, padding: 12, borderTop: '1px solid #eee' }}>
        {liveTranslate && (
          <div
            style={{
              marginBottom: 8,
              padding: '6px 10px',
              background: '#f0f7ff',
              borderRadius: 6,
              fontSize: 13,
              color: '#555',
              minHeight: 20,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              译文 ({conversation.visitor_locale})：
            </Typography.Text>
            {previewing ? <Spin size="small" /> : <span>{preview || '—'}</span>}
          </div>
        )}
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="输入回复，回车发送（Shift+回车换行）"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={() => void send()}>
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
