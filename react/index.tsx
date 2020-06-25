/* global module */
import 'core-js/es6/symbol'
import 'core-js/fn/symbol/iterator'

import { canUseDOM } from 'exenv'
import { prop } from 'ramda'

import * as runtimeGlobals from './core/main'
import { createCustomReactApollo } from './utils/reactApollo'
import { createReactIntl } from './utils/reactIntl'
import { fireUncriticalLoading } from './utils/uncritical'

window.__RENDER_8_RUNTIME__ = { ...runtimeGlobals }

// compatibility
window.__RENDER_8_COMPONENTS__ =
  window.__RENDER_8_COMPONENTS__ || global.__RENDER_8_COMPONENTS__
window.__RENDER_8_HOT__ = window.__RENDER_8_HOT__ || global.__RENDER_8_HOT__
global.__RUNTIME__ = window.__RUNTIME__

let intlPolyfillPromise: Promise<void> = Promise.resolve()

if (window.IntlPolyfill) {
  window.IntlPolyfill.__disableRegExpRestore()
  if (!window.Intl) {
    window.Intl = window.IntlPolyfill
  }
}
if (
  window.Intl &&
  canUseDOM &&
  (!window.Intl.PluralRules || !window.Intl.RelativeTimeFormat)
) {
  intlPolyfillPromise = import('./intl-polyfill').then(prop('default'))
}

if (module.hot) {
  module.hot.accept('./core/main', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hotGlobals = require('./core/main')
    window.__RENDER_8_RUNTIME__.ExtensionContainer =
      hotGlobals.ExtensionContainer
    window.__RENDER_8_RUNTIME__.ExtensionPoint = hotGlobals.ExtensionPoint
    window.__RENDER_8_RUNTIME__.LayoutContainer = hotGlobals.LayoutContainer
    window.__RENDER_8_RUNTIME__.Link = hotGlobals.Link
    window.__RENDER_8_RUNTIME__.Loading = hotGlobals.Loading
    window.__RENDER_8_RUNTIME__.buildCacheLocator = hotGlobals.buildCacheLocator
    runtimeGlobals.start()
  })
}

if (!window.__RUNTIME__.amp) {
  window.ReactAMPHTML = window.ReactAMPHTMLHelpers =
    typeof Proxy !== 'undefined'
      ? new Proxy(
          {},
          {
            get: (_, key) => {
              if (key === '__esModule' || key === 'constructor') {
                return
              }

              const message = canUseDOM
                ? 'You can not render AMP components on client-side'
                : 'You must check runtime.amp to render AMP components'

              throw new Error(message)
            },
          }
        )
      : {} // IE11 users will not have a clear error in this case
}

if (window.ReactApollo) {
  window.ReactApollo = createCustomReactApollo()
}

if (window.ReactIntl) {
  window.ReactIntl = createReactIntl()
}

if (window.__RUNTIME__.start && !window.__ERROR__) {
  if (canUseDOM) {
    const contentLoadedPromise = new Promise((resolve) =>
      window.addEventListener('DOMContentLoaded', resolve)
    )

    const uncriticalPromise = fireUncriticalLoading()
    Promise.all([contentLoadedPromise, intlPolyfillPromise]).then(() => {
      setTimeout(async () => {
        await uncriticalPromise
        window?.performance?.mark?.('render-start')
        window.__RENDER_8_RUNTIME__.start()
        window?.performance?.mark?.('render-end')
        window?.performance?.measure?.(
          '[VTEX IO] Rendering/Hydration',
          'render-start',
          'render-end'
        )
      }, 1)
    })
  } else {
    window.__RENDER_8_RUNTIME__.start()
  }
}
