import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { App as AntApp, Button, Empty, Input, Tag, Typography, Spin, Popover, Tabs, Select } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  SmileOutlined,
  CommentOutlined,
  FileImageOutlined,
  TranslationOutlined,
  FileOutlined,
  CheckOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import type { ChatMessage, Conversation, CannedResponse, MediaAsset } from '../types'

type Props = {
  conversation: Conversation
  messages: ChatMessage[]
  onSent: (msg: ChatMessage) => void
}

const MSG_TYPE_LABEL: Record<string, string> = {
  sticker: '贴纸',
  image: '图片',
  audio: '语音',
  voice: '语音',
  video: '视频',
  file: '文件',
  document: '文件',
  location: '位置',
}

const SEND_STATUS: Record<string, string> = {
  sent: '已发送',
  delivered: '已送达',
  read: '已读',
  failed: '发送失败',
}

// 边写边译目标语言（末项「关闭翻译」用于关掉开关，交互与网页端一致）
const TRANSLATE_TARGETS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
  { value: 'off', label: '关闭翻译' },
]

const MARKERS: Array<{ key: string; icon: ReactNode; marker: string; title: string }> = [
  { key: 'b', icon: <BoldOutlined />, marker: '*', title: '粗体' },
  { key: 'i', icon: <ItalicOutlined />, marker: '_', title: '斜体' },
  { key: 's', icon: <StrikethroughOutlined />, marker: '~', title: '删除线' },
  { key: 'm', icon: <CodeOutlined />, marker: '`', title: '等宽' },
]

const EMOJIS = ['😊', '👍', '🙏', '❤️', '😂', '🎉', '🔥', '✅', '💡', '👏', '🤝', '📞', '⏰', '💰', '📦', '✈️']

// 发送状态勾选：单勾=已发送，双灰勾=已送达，双蓝勾=已读
function StatusTicks({ status }: { status: string }) {
  if (status === 'pending') return <Spin size="small" />
  if (status === 'failed') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
  const read = status === 'read'
  return (
    <span className={`tick${read ? ' tick--read' : ''}`}>
      <CheckOutlined />
      <CheckOutlined style={{ marginLeft: -6 }} />
    </span>
  )
}

// 气泡：坐席视角——自己发的看原文（下方灰字是发给访客的译文），访客消息看译文
function Bubble({ m, grouped = false }: { m: ChatMessage; grouped?: boolean }) {
  const outbound = m.direction === 'outbound'
  const mediaUrl = m.media_url ?? undefined
  const primary = outbound ? (m.body_original ?? '') : (m.body_translated ?? m.body_original ?? '…')
  const secondary = outbound
    ? m.body_translated || null
    : m.body_translated
      ? (m.body_original ?? null)
      : null
  const isMedia = mediaUrl && m.msg_type && m.msg_type !== 'text'
  const nonTextPlaceholder = !mediaUrl && m.msg_type && m.msg_type !== 'text'

  const parts: string[] = []
  if (m.created_at) {
    parts.push(new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  }
  if (outbound) {
    parts.push(SEND_STATUS[m.status === 'pending' ? 'sent' : m.status] ?? m.status)
  }
  if (m.generated_by === 'ai') parts.push('AI')

  return (
    <div className={`bubble ${outbound ? 'bubble--out' : 'bubble--in'}`} style={grouped ? undefined : { marginTop: 10 }}>
      <div className="bubble__box">
        {isMedia ? (
          m.msg_type === 'image' || m.msg_type === 'sticker' ? (
            <img
              src={mediaUrl}
              alt={m.msg_type === 'sticker' ? '贴纸' : '图片'}
              className="bubble__media"
              style={m.body_original ? { marginBottom: 4 } : undefined}
            />
          ) : m.msg_type === 'video' ? (
            <video src={mediaUrl} controls className="bubble__media" />
          ) : m.msg_type === 'audio' || m.msg_type === 'voice' ? (
            <audio src={mediaUrl} controls style={{ display: 'block' }} />
          ) : (
            <a href={mediaUrl} target="_blank" rel="noreferrer" className="bubble__file">
              <FileOutlined /> 点击下载文件
            </a>
          )
        ) : null}
        {!nonTextPlaceholder ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{primary}</div>
        ) : (
          <div>{MSG_TYPE_LABEL[m.msg_type] ?? m.msg_type}</div>
        )}
        {secondary && secondary !== primary ? <div className="bubble__trans">{secondary}</div> : null}
      </div>
      {parts.length ? (
        <div className={`bubble__meta${outbound ? ' bubble__meta--out' : ''}`}>
          {outbound ? <StatusTicks status={m.status} /> : null}
          <span>{parts.join(' · ')}</span>
          {m.generated_by === 'ai' ? <span className="ai-tag">AI</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ChatPanel({ conversation, messages, onSent }: Props) {
  const { message: feedback } = AntApp.useApp()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [liveTranslate, setLiveTranslate] = useState(false)
  const [targetLocale, setTargetLocale] = useState(conversation.visitor_locale || 'en')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const previewTimer = useRef<number | null>(null)
  const lastPreviewed = useRef<string>('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<TextAreaRef>(null)

  // 切换会话时重置目标语言为访客语言
  useEffect(() => {
    setTargetLocale(conversation.visitor_locale || 'en')
  }, [conversation.id, conversation.visitor_locale])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, conversation.id])

  // 边写边译：开启后，输入框内容变化即防抖请求译文预览（目标语言可切换）
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
        const res = await api.translatePreview(conversation.id, t, targetLocale)
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
  }, [text, liveTranslate, targetLocale, conversation.id])

  // 乐观发送：先清空输入框，失败再把内容还回来
  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setText('')
    setSending(true)
    const opts = liveTranslate && preview ? { preTranslated: preview, targetLocale } : undefined
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

  // Markdown 标记：选中文字则包裹，否则插入标记对并把光标置于中间
  const wrap = (marker: string) => {
    const el = inputRef.current?.resizableTextArea?.textArea
    const pos = el ? (el.selectionStart ?? text.length) : text.length
    const end = el ? (el.selectionEnd ?? text.length) : text.length
    const selected = text.slice(pos, end)
    const next = text.slice(0, pos) + marker + selected + marker + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      el?.focus()
      const innerStart = pos + marker.length
      el?.setSelectionRange(innerStart, innerStart + selected.length)
    })
  }

  const insertEmoji = (e: string) => {
    const el = inputRef.current?.resizableTextArea?.textArea
    const pos = el ? (el.selectionStart ?? text.length) : text.length
    const next = text.slice(0, pos) + e + text.slice(pos)
    setText(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos + e.length, pos + e.length)
    })
    setEmojiOpen(false)
  }

  // 话术库 / 媒体库：只读选用（增删改在 web 后台）
  const [cannedOpen, setCannedOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [canned, setCanned] = useState<Record<string, CannedResponse[]>>({})
  const [media, setMedia] = useState<MediaAsset[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)

  const openCanned = (open: boolean) => {
    setCannedOpen(open)
    if (open && !Object.keys(canned).length) {
      setDrawerLoading(true)
      api
        .cannedResponses()
        .then(setCanned)
        .catch((e) => feedback.error((e as Error).message))
        .finally(() => setDrawerLoading(false))
    }
  }
  const insertCanned = (c: CannedResponse) => {
    setText((prev) => (prev ? `${prev}\n${c.content}` : c.content))
    setCannedOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const openMedia = (open: boolean) => {
    setMediaOpen(open)
    if (open && !media.length) {
      setDrawerLoading(true)
      api
        .mediaAssets()
        .then(setMedia)
        .catch((e) => feedback.error((e as Error).message))
        .finally(() => setDrawerLoading(false))
    }
  }
  const sendMedia = async (a: MediaAsset) => {
    if (sending) return
    setSending(true)
    setMediaOpen(false)
    try {
      onSent(await api.send(conversation.id, '', { mediaAssetId: a.id }))
    } catch (e) {
      feedback.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  // 边写边译目标语言选择（选「关闭翻译」即关掉开关）
  const onTargetChange = (v: string) => {
    if (v === 'off') {
      setLiveTranslate(false)
      return
    }
    setTargetLocale(v)
    if (!liveTranslate) setLiveTranslate(true)
  }

  const cannedTabs = Object.entries(canned).map(([cat, items]) => ({
    key: cat || '_',
    label: cat || '未分类',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((c) => (
          <Button
            key={c.id}
            size="small"
            style={{ textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '6px 10px' }}
            onClick={() => insertCanned(c)}
          >
            <Typography.Text strong style={{ fontSize: 12 }}>
              {c.title}
            </Typography.Text>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 2 }}>
              {c.content}
            </Typography.Paragraph>
          </Button>
        ))}
      </div>
    ),
  }))

  const channelLabel = conversation.channel === 'whatsapp' ? 'WhatsApp' : '网页聊天'
  const dayOf = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) : ''

  return (
    <div className="chat">
      <div className="chat-header">
        <div className={`chat-header__avatar${conversation.channel === 'whatsapp' ? ' chat-header__avatar--wa' : ''}`}>
          {(conversation.visitor_name || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="chat-header__meta">
          <div className="chat-header__name">{conversation.visitor_name}</div>
          <div className="chat-header__status">
            {channelLabel} · {conversation.visitor_locale}
          </div>
        </div>
        <div className="chat-header__tags">
          <Tag color={conversation.channel === 'whatsapp' ? 'green' : 'blue'}>{channelLabel}</Tag>
          <Tag>{conversation.visitor_locale}</Tag>
          {conversation.ai_handoff ? <Tag color="gold">已转人工</Tag> : null}
        </div>
      </div>

      <div ref={listRef} className="chat-msgs">
        {messages.length === 0 ? (
          <Empty description="暂无消息" style={{ margin: 'auto' }} />
        ) : (
          <div className="chat-msgs__inner">
            {messages.map((m, i) => {
              const prevDay = dayOf(messages[i - 1]?.created_at)
              const curDay = dayOf(m.created_at)
              const sep = prevDay !== curDay ? <div className="day-sep">{curDay}</div> : null
              return (
                <div key={m.id}>
                  {sep}
                  <Bubble m={m} grouped={i > 0 && messages[i - 1].direction === m.direction} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="chat-input">
        <div className="chat-toolbar">
          {MARKERS.map((it) => (
            <button key={it.key} className="chat-tool" title={it.title} onClick={() => wrap(it.marker)}>
              {it.icon}
            </button>
          ))}
          <span className="chat-divider" />
          <Popover
            trigger="click"
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            content={
              <div style={{ width: 248, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                {EMOJIS.map((e) => (
                  <button key={e} className="chat-tool" style={{ fontSize: 18 }} onClick={() => insertEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            }
          >
            <button className="chat-tool" title="表情">
              <SmileOutlined />
            </button>
          </Popover>
          <Popover
            trigger="click"
            open={cannedOpen}
            onOpenChange={openCanned}
            content={
              <div style={{ maxWidth: 360, maxHeight: 320, overflowY: 'auto' }}>
                {drawerLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin />
                  </div>
                ) : Object.keys(canned).length === 0 ? (
                  <Empty description="暂无话术" />
                ) : (
                  <Tabs size="small" items={cannedTabs} />
                )}
              </div>
            }
          >
            <button className="chat-tool" title="话术库">
              <CommentOutlined />
            </button>
          </Popover>
          <Popover
            trigger="click"
            open={mediaOpen}
            onOpenChange={openMedia}
            content={
              <div style={{ maxWidth: 360, maxHeight: 320, overflowY: 'auto' }}>
                {drawerLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin />
                  </div>
                ) : media.length === 0 ? (
                  <Empty description="媒体库为空" />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {media.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => void sendMedia(a)}
                        title={`${a.name}（点击发送）`}
                        style={{ cursor: 'pointer', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', background: '#fff' }}
                      >
                        <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                          {a.url ? (
                            <img src={a.url} alt={a.name} style={{ width: '100%', height: 72, objectFit: 'cover' }} />
                          ) : (
                            <FileOutlined style={{ fontSize: 24, color: '#999' }} />
                          )}
                        </div>
                        <div style={{ padding: '4px 6px', fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          >
            <button className="chat-tool" title="媒体库">
              <FileImageOutlined />
            </button>
          </Popover>
          <span style={{ marginLeft: 'auto' }}>
            <button
              className={`chat-tool${liveTranslate ? ' chat-tool--on' : ''}`}
              title="边写边译"
              onClick={() => setLiveTranslate((v) => !v)}
            >
              <TranslationOutlined />
            </button>
          </span>
        </div>

        {liveTranslate ? (
          <div className="chat-trans">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                将输入内容翻译为
              </Typography.Text>
              <Select
                size="small"
                variant="borderless"
                value={targetLocale}
                onChange={onTargetChange}
                options={TRANSLATE_TARGETS}
                style={{ minWidth: 96 }}
                popupMatchSelectWidth={false}
              />
            </div>
            <span style={{ fontSize: 13, color: previewing ? '#999' : '#555' }}>
              {previewing ? '翻译中…' : (preview || '译文将在此显示')}
            </span>
          </div>
        ) : null}

        <Input.TextArea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="输入回复，回车发送（Shift+回车换行）；支持 *粗体* _斜体_ ~删除线~ `等宽`"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="chat-send-btn" disabled={sending || !text.trim()} onClick={() => void send()}>
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
