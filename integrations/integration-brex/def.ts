/** Used for the side effect of window.MergeLink */
import type {IntegrationDef, IntegrationSchemas} from '@usevenice/cdk-core'
import {intHelpers} from '@usevenice/cdk-core'
import {z, zCast} from '@usevenice/util'

import type {components} from './__generated__/transactions.gen'

// TODO: Split into 3 files... Def aka common / Client / Server

export const brexSchemas = {
  name: z.literal('brex'),
  integrationConfig: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
  }),
  institutionData: z.unknown(),
  resourceSettings: z.object({
    accessToken: z.string(),
  }),
  sourceOutputEntity: z.discriminatedUnion('entityName', [
    z.object({
      id: z.string(),
      entityName: z.literal('account'),
      entity: zCast<
        | components['schemas']['CardAccount']
        | components['schemas']['CashAccount']
      >(),
    }),
    z.object({
      id: z.string(),
      entityName: z.literal('transaction'),
      entity: zCast<
        | components['schemas']['CardTransaction']
        | components['schemas']['CashTransaction']
      >(),
    }),
  ]),
} satisfies IntegrationSchemas

export const brexDef = {
  def: brexSchemas,
  name: 'brex',
  metadata: {
    categories: ['banking'],
    logoUrl: '/_assets/logo-brex.png',
    stage: 'beta',
  },
  standardMappers: {
    institution: () => ({
      name: 'Brex',
      logoUrl: 'Add brex logo...',
      envName: undefined,
      categories: ['banking'],
    }),
    resource() {
      return {
        displayName: '',
        // status: healthy vs. disconnected...
        // labels: test vs. production
      }
    },
  },
  extension: {
    sourceMapEntity: {
      account: (entity) => ({
        id: entity.id,
        entityName: 'account',
        entity: {
          name: 'name' in entity.entity ? entity.entity.name : 'Brex Card',
        },
      }),
      // transaction: (entity) => ({
      //   id: entity.id,
      //   entityName: 'transaction',
      //   entity: {date: entity.entity.transaction_date},
      // }),
    },
  },
} satisfies IntegrationDef<typeof brexSchemas>

export const helpers = intHelpers(brexSchemas)

export default brexDef