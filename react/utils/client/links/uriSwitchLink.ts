import { ApolloLink, NextLink, Operation } from 'apollo-link'
import { canUseDOM } from 'exenv'
import { ASTNode, DirectiveNode, OperationDefinitionNode, StringValueNode, visit } from 'graphql'

import { generateHash } from '../generateHash'

interface Assets {
  operationType: string,
  queryScope?: string
}

const assetsFromQuery = (query: ASTNode) => {
  const assets: Assets = {operationType: 'mutation'}
  visit(query, {
    Directive (node: DirectiveNode) {
      if (node.name.value === 'context') {
        const scopeArg = node.arguments && node.arguments.find((argNode) => argNode.name.value === 'scope')
        if (scopeArg) {
          assets.queryScope = (scopeArg.value as StringValueNode).value
        }
      }
    },
    OperationDefinition (node: OperationDefinitionNode) {
      assets.operationType = node.operation
    },
  })
  return assets
}

interface OperationContext {
  fetchOptions: any,
  runtime: RenderRuntime,
}

const equals = (a: string, b: string) => a && b && a.toLowerCase() === b.toLowerCase()

const extractHints = (query: ASTNode, meta: CacheHints) => {
  const {operationType, queryScope} = assetsFromQuery(query)

  let hints
  if (equals(operationType, 'query')) {
    hints = meta ? meta : {scope: queryScope}
  } else {
    hints = {...meta, scope: 'private'}
  }

  const {maxAge = 'long', scope = 'public', version = 1} = hints
  return {
    maxAge: maxAge.toLowerCase(),
    operationType,
    scope: scope.toLowerCase(),
    version,
  }
}

export const createUriSwitchLink = (baseURI: string, workspace: string, locale: string, production: boolean, domain?: string) =>
  new ApolloLink((operation: Operation, forward?: NextLink) => {
    operation.setContext((oldContext: OperationContext) => {
      const { fetchOptions = {}, runtime: {appsEtag, cacheHints} } = oldContext
      const hash = generateHash(operation.query)

      if (!production && !hash) {
        throw new Error(
          'Could not generate hash from query. Are you using graphql-tag ? Split your graphql queries in .graphql files and import them instead'
        )
      }

      const includeQuery = (oldContext as any).http?.includeQuery || !hash
      const oldMethod = includeQuery ? 'POST' : (fetchOptions.method || 'POST')
      const protocol = canUseDOM && !window.location.host.startsWith('localhost') ? 'https:' : 'http:'
      const {maxAge, scope, version, operationType} = extractHints(operation.query, cacheHints[hash])
      const method = (equals(scope, 'private') && equals(operationType, 'query')) ? 'POST' : oldMethod
      return {
        ...oldContext,
        http: {
          ...(oldContext as any).http,
          includeQuery,
        },
        fetchOptions: {...fetchOptions, method},
        uri: `${protocol}//${baseURI}/_v/${scope}/graphql/v${version}?workspace=${workspace}&maxAge=${maxAge}&appsEtag=${appsEtag}&domain=${domain}&locale=${locale}`,
      }
    })
    return forward ? forward(operation) : null
  })
