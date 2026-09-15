import { useState } from 'react'
import { App as AntApp, Button, Card, Form, Input, Typography } from 'antd'
import { api, getBaseUrl, setBaseUrl } from '../api'
import type { LoginUser } from '../types'

type Props = {
  onSuccess: (user: LoginUser) => void
}

// 登录页：账号支持邮箱或「坐席名@租户slug」；服务器地址默认线上，可改（便于本地联调）
export default function LoginView({ onSuccess }: Props) {
  const { message } = AntApp.useApp()
  const [loading, setLoading] = useState(false)
  const [base, setBase] = useState(getBaseUrl())

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
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f6f8',
      }}
    >
      <Card title="Seaply 客服工作台" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={submit}>
          <Form.Item
            name="account"
            label="账号"
            rules={[{ required: true, message: '请输入邮箱或 坐席名@租户' }]}
          >
            <Input placeholder="you@example.com 或 xiaoli@demo" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form>

        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            服务器地址
          </Typography.Text>
          <Input
            size="small"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </div>
      </Card>
    </div>
  )
}
