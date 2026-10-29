import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LastUpdated from '../LastUpdated'

describe('LastUpdated', () => {
  it('shows a waiting state before any data arrives', () => {
    render(<LastUpdated timestamp={null} />)
    expect(screen.getByText(/等待数据/)).toBeInTheDocument()
  })

  it('marks recent data as fresh and shows a relative time', () => {
    render(<LastUpdated timestamp={Date.now() - 5000} />)
    expect(screen.getByText(/最后更新：/)).toBeInTheDocument()
    expect(screen.getByText(/刚刚/)).toBeInTheDocument()
    expect(document.querySelector('.rankings-updated--fresh')).toBeTruthy()
  })

  it('flags data older than 90 seconds as delayed', () => {
    render(<LastUpdated timestamp={Date.now() - 120000} />)
    expect(screen.getByText(/2 分钟前/)).toBeInTheDocument()
    expect(document.querySelector('.rankings-updated--delayed')).toBeTruthy()
  })

  it('flags data older than 5 minutes as stale', () => {
    render(<LastUpdated timestamp={Date.now() - 6 * 60 * 1000} />)
    expect(screen.getByText(/6 分钟前/)).toBeInTheDocument()
    expect(document.querySelector('.rankings-updated--stale')).toBeTruthy()
  })
})
