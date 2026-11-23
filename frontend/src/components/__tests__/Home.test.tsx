import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Home from '../Home'

// 首页挂载后会请求题目列表；测试环境没有后端，这里统一返回空列表，
// 让组件走完 loading -> 渲染这一整条路径。
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 200, msg: 'success', data: [] }),
  }))
})

describe('Home Component', () => {
  it('renders without crashing', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
    expect(document.body).toBeInTheDocument()
    // 等待 loading 结束，避免状态更新发生在测试卸载之后
    await screen.findByText('核心功能')
  })

  it('renders the feature overview after loading', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
    expect(await screen.findByText('核心功能')).toBeInTheDocument()
  })
})
