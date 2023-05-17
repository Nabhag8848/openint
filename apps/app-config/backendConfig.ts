import type {Link, LinkFactory} from '@usevenice/cdk-core'
import {logLink, makeId, swapPrefix} from '@usevenice/cdk-core'
import type {EntityPayloadWithExternal} from '@usevenice/cdk-ledger'
import {
  addRemainderByDateLink,
  mapAccountNameAndTypeLink,
  mapStandardEntityLink,
  renameAccountLink,
} from '@usevenice/cdk-ledger'
import {makePostgresMetaService} from '@usevenice/core-integration-postgres'
import type {PipelineInput} from '@usevenice/engine-backend'
import {getContextFactory} from '@usevenice/engine-backend'
import {joinPath, R, Rx, zParser} from '@usevenice/util'

import {veniceCommonConfig} from './commonConfig'
import {getServerUrl} from './constants'
import {zAllEnv} from './env'
import type {PROVIDERS} from './providers'

export {DatabaseError} from '@usevenice/core-integration-postgres/register.node'
export {Papa} from '@usevenice/integration-import'
export {makePostgresClient} from '@usevenice/integration-postgres'

const env = zParser(zAllEnv).parseUnknown(process.env)

export const backendEnv = env

const usePg = env.POSTGRES_OR_WEBHOOK_URL.startsWith('postgres')

/**
 * This requires the env vars to exist...
 * TODO: Separate it so that the entire config isn't constructed client side
 * and only the minimal needed methods are...
 */

// After upgrading from zod 3.19 to zod 3.20.2 CastInput is now broken
// @see https://share.cleanshot.com/vpzSPkjP
// It's probably better to keep typing simpler especially when working with 3rd party
// libs that can have major changes...
// export type VeniceInput = inferProcedureInput<
//   VeniceRouter['_def']['mutations']['syncPipeline']
// >[0]
export type VeniceInput = PipelineInput<
  (typeof PROVIDERS)[number],
  (typeof PROVIDERS)[number]
>

export const contextFactory = getContextFactory({
  ...veniceCommonConfig,
  jwtSecret: env.JWT_SECRET_OR_PUBLIC_KEY,
  getRedirectUrl: (_, _ctx) => joinPath(getServerUrl(null), '/'),
  getMetaService: (viewer) =>
    makePostgresMetaService({databaseUrl: env.POSTGRES_OR_WEBHOOK_URL, viewer}),
  // TODO: Support other config service such as fs later...
  linkMap: {
    renameAccount: renameAccountLink as LinkFactory,
    log: logLink,
  },
  // Integrations shall include `config`.
  // In contrast, resource shall include `external`
  // We do need to figure out which secrets to tokenize and which one not to though
  // Perhaps the best way is to use `secret_` prefix? (think how we might work with vgs)

  // TODO: Deprecate me. This does not make much sense to have getLinksForPipeline
  getLinksForPipeline: ({source, links, destination}) => {
    if (destination.integration.provider.name === 'beancount') {
      return [
        ...links,
        mapStandardEntityLink(source),
        addRemainderByDateLink as Link, // What about just the addRemainder plugin?
        // renameAccountLink({
        //   Ramp: 'Ramp/Posted',
        //   'Apple Card': 'Apple Card/Posted',
        // }),
        mapAccountNameAndTypeLink() as Link,
        logLink({prefix: 'preDest', verbose: true}),
      ]
    }
    if (destination.integration.provider.name === 'alka') {
      return [
        ...links,
        // logLink({prefix: 'preMap'}),
        mapStandardEntityLink(source),
        // prefixIdLink(src.provider.name),
        logLink({prefix: 'preDest'}),
      ]
    }
    if (source.integration.provider.name === 'postgres') {
      return [...links, logLink({prefix: 'preDest'})]
    }
    return [
      ...links,
      // logLink({prefix: 'preMapStandard', verbose: true}),
      mapStandardEntityLink(source),
      Rx.map((op) =>
        op.type === 'data' &&
        destination.integration.provider.name !== 'postgres'
          ? R.identity({
              ...op,
              data: {
                ...op.data,
                entity: {
                  standard: op.data.entity,
                  external: (op.data as EntityPayloadWithExternal).external,
                },
              },
            })
          : op,
      ),
      logLink({prefix: 'preDest'}),
    ]
  },
  // When do we perform migration?
  getDefaultPipeline: (conn) => ({
    id: conn?.id ? swapPrefix(conn.id, 'pipe') : makeId('pipe', 'default'),
    // TODO: Handle default soruce scenario
    source: conn,
    // TODO: Make me parsable from env vars
    destination: usePg
      ? {
          id: 'reso_postgres',
          settings: {databaseUrl: env.POSTGRES_OR_WEBHOOK_URL},
        }
      : {
          id: 'reso_webhook',
          settings: {destinationUrl: env.POSTGRES_OR_WEBHOOK_URL},
        },
  }),
})
