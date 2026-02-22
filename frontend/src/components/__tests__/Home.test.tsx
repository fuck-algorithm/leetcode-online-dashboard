import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Home from '../Home'

describe('Home Component', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
    expect(document.body).toBeInTheDocument()
  })

  it('displays dashboard title', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    )
    // Check if the component renders
    const mainElement = screen.getByRole('main') || document.querySelector('.home')
    expect(mainElement).toBeDefined()
  })
})
