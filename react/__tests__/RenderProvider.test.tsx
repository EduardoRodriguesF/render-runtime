import React, { useEffect } from 'react'
import RenderProvider from '../components/RenderProvider'
import { useRuntime } from '../core/main'
import { render, wait } from '@vtex/test-tools/react'

const renderFakeProvider = ({ children }: { children: JSX.Element }) => {
  window.fetch = () => Promise.resolve({} as Response)
  window.__RENDER_8_SESSION__ = {
    sessionPromise: Promise.resolve(),
    patchSession: () => Promise.resolve(),
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  const props = {
    apollo: {
      getClient: jest.fn(),
      hydrate: jest.fn(),
    },
    runtime: {
      account: 'vtex',
      amp: false,
      emitter: {
        addListener: () => {},
        removeListener: () => {},
      },
      production: false,
      route: {
        canonicalPath: '',
      },
      culture: {
        locale: 'en-US',
      },
      components: {},
      blocks: {},
      pages: {
        page: {
          path: 'page/:id',
        },
      },
      hints: {
        mobile: false,
        desktop: true,
        tablet: false,
        phone: false,
        unknown: false,
      },
    },
    history: {
      location: {
        search: '',
        pathname: '',
      },
      replace: () => {},
      push: () => {},
      listen: () => {},
    },
  }
  return render(<RenderProvider {...(props as any)}>{children}</RenderProvider>)
}

it('if child component calls navigate, should return true', async () => {
  let navigateResult = false

  const Child = () => {
    const { navigate } = useRuntime()

    useEffect(() => {
      navigateResult = navigate({ to: 'product' })
    }, [navigate])

    return <div>children</div>
  }

  renderFakeProvider({ children: <Child /> })

  await wait()

  expect(navigateResult).toBe(true)
})

it('Calling navigates one after another with same payload, will make second one return false', async () => {
  let navigateResultFirst = undefined
  let navigateResultSecond = undefined

  const Child = () => {
    const { navigate } = useRuntime()

    useEffect(() => {
      navigateResultFirst = navigate({ to: 'product' })
      navigateResultSecond = navigate({ to: 'product' })
    }, [navigate])

    return <div>children</div>
  }

  renderFakeProvider({ children: <Child /> })

  await wait()

  expect(navigateResultFirst).toBe(true)
  expect(navigateResultSecond).toBe(false)
})

it('Calling navigates one after another with different payload, will make second one return true also', async () => {
  let navigateResultFirst = undefined
  let navigateResultSecond = undefined

  const Child = () => {
    const { navigate } = useRuntime()

    useEffect(() => {
      navigateResultFirst = navigate({ to: 'product' })
      navigateResultSecond = navigate({ to: 'other-product' })
    }, [navigate])

    return <div>children</div>
  }

  renderFakeProvider({ children: <Child /> })
  await wait()

  expect(navigateResultFirst).toBe(true)
  expect(navigateResultSecond).toBe(true)
})

it('Calling navigates to redirect to the checkout', async () => {
  let navigateResult

  window.location.assign = jest.fn()

  const Child = () => {
    const { navigate } = useRuntime()

    useEffect(() => {
      navigateResult = navigate({
        to: '/#/checkout',
        fallbackToWindowLocation: true,
      })
    }, [navigate])

    return <div>children</div>
  }

  renderFakeProvider({ children: <Child /> })

  await wait()

  expect(window.location.assign).toHaveBeenCalledWith('/checkout')
  expect(navigateResult).toBe(true)
})

it('Calling navigates to redirect to a custom page with queryParams', async () => {
  let navigateResult

  window.location.assign = jest.fn()

  const Child = () => {
    const { navigate } = useRuntime()
    useEffect(() => {
      navigateResult = navigate({
        to: '/product-id/additional?v=2',
        fallbackToWindowLocation: true,
      })
    }, [navigate])

    return <div>children</div>
  }

  renderFakeProvider({ children: <Child /> })

  await wait()

  expect(window.location.assign).toHaveBeenCalledWith(
    '/product-id/additional?v=2'
  )
  expect(navigateResult).toBe(true)
})

const input: [any, any, any][] = [
  [
    { to: 'product', params: { id: 'a' } },
    { to: 'product', params: { id: 'a' } },
    false,
  ],
  [
    { to: 'product', params: { id: 'a' } },
    { to: 'product2', params: { id: 'a' } },
    true,
  ],
  [
    { to: 'product', params: { id: 'a' } },
    { to: 'product', params: { id: 'a', rest: 'b' } },
    true,
  ],
  [
    { page: 'page', params: { id: 'a' } },
    { page: 'page', params: { id: 'a' } },
    false,
  ],
  [
    { page: 'page', params: { id: 'a' } },
    { page: 'page', params: { id: 'b' } },
    true,
  ],
]

it.each(input)(
  'test if navigation is properly exiting early based on different repeated input',
  async (arg1: any, arg2: any, expected: boolean) => {
    let navigateResultFirst = undefined
    let navigateResultSecond = undefined

    const Child = () => {
      const { navigate } = useRuntime()

      useEffect(() => {
        navigateResultFirst = navigate(arg1)
        navigateResultSecond = navigate(arg2)
      }, [navigate])

      return <div>children</div>
    }

    renderFakeProvider({ children: <Child /> })

    await wait()

    expect(navigateResultFirst).toBe(true)
    expect(navigateResultSecond).toBe(expected)
  }
)
