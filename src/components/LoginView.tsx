import { useState } from 'react'
import { App as AntApp, Collapse, Form, Input, Typography } from 'antd'
import {
  LockOutlined,
  UserOutlined,
  GlobalOutlined,
  MessageOutlined,
  TranslationOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { api, getBaseUrl, setBaseUrl } from '../api'
import type { LoginUser } from '../types'

type Props = {
  onSuccess: (user: LoginUser) => void
}

// 白底圆角方块 + 蓝色对话气泡的 Logo，在亮/暗背景上都清晰
function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#fff" />
      <path
        d="M9 13a5.5 5.5 0 0 1 5.5-5.5h3A5.5 5.5 0 0 1 23 13v3.5a5.5 5.5 0 0 1-5.5 5.5H14l-4 3v-3h-.5A5.5 5.5 0 0 1 9 16.5V13z"
        fill="url(#lg)"
      />
      <defs>
        <linearGradient id="lg" x1="9" y1="7" x2="23" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4c6ef5" />
          <stop offset="1" stopColor="#3b5bdb" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const FEATURES = [
  { icon: <MessageOutlined />, text: '多渠道对话统一收口，告别来回切换' },
  { icon: <TranslationOutlined />, text: '实时翻译，无障碍服务全球客户' },
  { icon: <RobotOutlined />, text: 'AI 辅助应答，坐席效率倍增' },
]

// 登录页：账号支持邮箱或「坐席名@租户slug」；服务器地址默认线上，收进高级设置便于本地联调
export default function LoginView({ onSuccess }: Props) {
  const { message } = AntApp.useApp()
  const [loading, setLoading] = useState(false)
  const [base, setBase] = useState(getBaseUrl())
  const [form] = Form.useForm<{ account: string; password: string }>()

  const submit = async (values: { account: string; password: string }) => {
    setLoading(true)
    try {
      setBaseUrl(base)
      const res = await api.login(values.account.trim(), values.password)
      message.success(`欢迎，${res.user.name}`)
      onSuccess(res.user)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <aside className="login-brand">
        <div className="login-brand__glow login-brand__glow--1" />
        <div className="login-brand__glow login-brand__glow--2" />

        <div className="login-brand__logo">
          <BrandLogo />
          <span className="login-brand__logo-text">Seaply</span>
        </div>

        <div className="login-brand__hero">
          <h1 className="login-brand__title">
            连接每一次
            <br />
            客户对话
          </h1>
          <p className="login-brand__subtitle">
            一个工作台，接管你所有的客户消息、翻译与智能应答。
          </p>
          <div className="login-brand__features">
            {FEATURES.map((f) => (
              <div className="login-feature" key={f.text}>
                <span className="login-feature__icon">{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-brand__foot">© 2026 Seaply · 客服工作台</div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card__brand">
            <BrandLogo size={28} />
            <span className="login-card__name">Seaply Desk</span>
            <span className="login-card__ver">v0.1.0</span>
          </div>

          <h2 className="login-card__title">欢迎回来</h2>
          <p className="login-card__hint">登录以接入你的客户会话</p>

          <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item
              name="account"
              label="账号"
              rules={[{ required: true, message: '请输入邮箱或 坐席名@租户' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="you@example.com 或 xiaoli@demo"
                size="large"
                autoFocus
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? '登录中…' : '登 录'}
              </button>
            </Form.Item>
          </Form>

          <Collapse
            ghost
            size="small"
            className="login-adv"
            items={[
              {
                key: 'adv',
                label: (
                  <span style={{ fontSize: 12, color: '#9aa4b2' }}>高级设置</span>
                ),
                children: (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      服务器地址
                    </Typography.Text>
                    <Input
                      prefix={<GlobalOutlined />}
                      size="small"
                      value={base}
                      onChange={(e) => setBase(e.target.value)}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </main>
    </div>
  )
}
