import {
  HeuristicFragmentMatcher,
  InMemoryCache,
  NormalizedCacheObject,
} from 'apollo-cache-inmemory'
import { ApolloClient } from 'apollo-client'
import { ApolloLink } from 'apollo-link'
import { onError } from 'apollo-link-error'
import { createHttpLink } from 'apollo-link-http'
import { createPersistedQueryLink } from 'apollo-link-persisted-queries'
import { createUploadLink } from 'apollo-upload-client'
import { canUseDOM } from 'exenv'

import PageCacheControl from '../cacheControl'
import graphQLErrorsStore from '../graphQLErrorsStore'
import { generateHash } from './generateHash'
import { toBase64Link } from './links/base64Link'
import { cachingLink } from './links/cachingLink'
import { createIOFetchLink } from './links/ioFetchLink'
import { omitTypenameLink } from './links/omitVariableTypenameLink'
import { createUriSwitchLink } from './links/uriSwitchLink'
import { versionSplitterLink } from './links/versionSplitterLink'

interface ApolloClientsRegistry {
  [key: string]: ApolloClient<NormalizedCacheObject>
}

const buildCacheId = (
  vendor: string,
  app: string,
  major: string,
  type: string,
  cacheId: string
) => `${vendor}.${app}@${major}.x:${type}:${cacheId}`

const dataIdFromObject = (value: any) => {
  const { cacheId, __typename } = value || ({} as any)
  if (value && __typename && cacheId) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [vendor, app, major, minor, patch, ...type] = __typename.split('_')
    return buildCacheId(vendor, app, major, type, cacheId)
  }
  return null
}

export const buildCacheLocator = (
  app: string,
  type: string,
  cacheId: string
) => {
  const [vendor, appAndMajor] = app.replace(/-/g, '').split('.')
  const [appName, major] = appAndMajor && appAndMajor.split('@')
  return buildCacheId(vendor, appName, major, type, cacheId)
}

const clientsByWorkspace: ApolloClientsRegistry = {}

export const getState = (runtime: RenderRuntime) => {
  const { account, workspace } = runtime
  const apolloClient = clientsByWorkspace[`${account}/${workspace}`]
  return apolloClient ? apolloClient.cache.extract() : {}
}

export const getClient = (
  runtime: RenderRuntime,
  baseURI: string,
  runtimeContextLink: ApolloLink,
  ensureSessionLink: ApolloLink,
  cacheControl?: PageCacheControl
) => {
  const { account, workspace } = runtime

  if (!clientsByWorkspace[`${account}/${workspace}`]) {
    const cache = new InMemoryCache({
      addTypename: true,
      dataIdFromObject,
      fragmentMatcher: new HeuristicFragmentMatcher(),
    })

    const httpLink = ApolloLink.from([
      toBase64Link,
      createHttpLink({
        credentials: 'include',
        useGETForQueries: false,
      }),
    ])

    const uploadLink = createUploadLink({
      credentials: 'include',
    })

    const fetcherLink = createIOFetchLink(httpLink, uploadLink)

    const persistedQueryLink = createPersistedQueryLink({
      disable: () => false,
      generateHash,
      useGETForHashedQueries: true,
    })

    const uriSwitchLink = createUriSwitchLink(baseURI, runtime)

    const cacheLink = cacheControl ? [cachingLink(cacheControl)] : []

    const errorLink = onError(({ graphQLErrors }) => {
      if (graphQLErrors) {
        graphQLErrorsStore.addOperationIds(graphQLErrors)
      }
    })

    const link = ApolloLink.from([
      errorLink,
      omitTypenameLink,
      versionSplitterLink,
      runtimeContextLink,
      ensureSessionLink,
      ...(canUseDOM ? [persistedQueryLink] : []),
      uriSwitchLink,
      ...cacheLink,
      fetcherLink,
    ])

    clientsByWorkspace[`${account}/${workspace}`] = new ApolloClient({
      cache: canUseDOM ? cache.restore(window.__STATE__) : cache,
      link,
      resolvers: {},
      ssrMode: !canUseDOM,
    })
  }

  return clientsByWorkspace[`${account}/${workspace}`]
}
