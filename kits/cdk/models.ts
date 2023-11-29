import {z} from '@usevenice/zod'
import {zEndUserId, zId} from './id.types'

// Utility types

// Types
// Input type (generic, nested)
// - Normlaized, DB type conforms to input type (not generic, possibly generated)
// Output type (parsed, generic, nested)

export type EnvName = z.infer<typeof zEnvName>
export const zEnvName = z.enum(['sandbox', 'development', 'production'])

// MARK: - Standard types

// Should this live inside ZStandard?
/** Will allow users to make these required as needed */
export const zStandardConnectorConfig = z.object({
  env_name: z
    .string()
    .nullish()
    .describe('e.g. sandbox, development, production'),
  pipeline_defaults: z
    .object({
      // TODO: Add representation for configured streams for pipeline also, and of course allow pipelipe
      // to override these settings
      sync_frequency: z
        .enum(['manual', 'hourly', 'daily', 'weekly', 'monthly'])
        .nullish(),
    })
    .nullish()
    .describe('Not implemented yet'),
})

export const zIntegrationCategory = z.enum([
  'accounting',
  'banking',
  'hris', // Aka payroll
])

export type ZStandard = {
  [k in keyof typeof zStandard]: z.infer<(typeof zStandard)[k]>
}
export const zStandard = {
  integration: z.object({
    id: zId('int'),
    name: z.string(),
    // No http prefix preprocessing for logo url as they can be data urls
    logoUrl: z.string().url().optional(),
    loginUrl: z.preprocess(
      // Sometimes url get returned without http prefix...
      // Is there a way to "catch" invalid url error then retry with prefix?
      // Would be better than just prefixing semi-blindly.
      (url) =>
        typeof url === 'string' && !url.toLowerCase().startsWith('http')
          ? `https://${url}`
          : url,
      z.string().url().optional(),
    ),
    categories: z.array(zIntegrationCategory).nullish(),
  }),
  resource: z.object({
    id: zId('reso'),
    displayName: z.string(),
    /**
     * This correspond to the connection status.
     * Pipeline shall have a separate syncStatus */
    status: z
      .enum([
        'healthy', // Connected and all is well
        'disconnected', // User intervention needed to reconnect
        'error', // System error, nothing user can do. This would also include revoked
        'manual', // This is a manual connection (e.g. import. So normal status does not apply)
      ])
      .nullish(), // Status unknown
    statusMessage: z.string().nullish(),
    labels: z.array(z.string()).optional(),
  }),
}

// TODO: Make the Input types compatible with our raw types...

// MARK: - Raw types

export type ZRaw = {
  [k in keyof typeof zRaw]: z.infer<(typeof zRaw)[k]>
}
/** Should this be a factory function so we can use typed config / settings? */
// TODO: Consider auto-generating this from database, via a tool such as zapetos, pgtyped
// or prisma, though would need to allow us to override for things like id prefix as well
// as more specific type than just jsonb

const zBase = z.object({
  createdAt: z.date(), // should be string but slonik returns date
  updatedAt: z.date(), // should be string but slonik returns date
})

/** TODO: Add other links / gather the schema from various links here */
export const zLink = z.enum(['banking']).openapi({ref: 'Link'})

export const zRaw = {
  connector_config: zBase
    .extend({
      id: zId('ccfg'),
      connectorName: z.string(),
      config: z.record(z.unknown()).nullish(),
      /** @deprecated. This should be determined on a per-portal basis */
      endUserAccess: z
        .boolean()
        .nullish()
        .describe(
          "Allow end user to create resources using this connector's configuration",
        ),
      orgId: zId('org'),
      displayName: z.string().nullish(),
      disabled: z.boolean().optional(),

      /** Could be full object later */
      defaultPipeOut: z
        .object({
          streams: z.record(z.boolean()).nullish(),
          links: z
            .array(zLink)
            .nullish()
            .describe(
              'Array of transformations that the data gets piped through on the way out. Typically used for things like unification / normalization.',
            ),
          destination_id: zId('reso'),
        })
        .nullish()
        .describe(
          'Automatically sync data from any resources associated with this config to the destination resource, which is typically a Postgres database. Think ETL',
        ),
      defaultPipeIn: z
        .object({
          links: z
            .array(zLink)
            .nullish()
            .describe(
              'Array of transformations that the data gets piped through on the way out. Typically used for things like unification / normalization.',
            ),
          source_id: zId('reso'),
        })
        .nullish()
        .describe(
          'Automatically sync data from any resources associated with this config to the destination resource, which is typically a Postgres database. Think ETL',
        ),
      /** This is a generated column, which is not the most flexible. Maybe we need some kind of mapStandardIntegration method? */
      envName: z.string().nullish(),
    })
    .openapi({ref: 'ConnectorConfig'}),
  resource: zBase
    .extend({
      id: zId('reso'),
      connectorName: z.string().describe('Unique name of the connector'),
      displayName: z.string().nullish(),
      endUserId: zEndUserId.nullish(),
      connectorConfigId: zId('ccfg'),
      integrationId: zId('int').nullish(),
      settings: z.record(z.unknown()).nullish(),
      standard: zStandard.resource.omit({id: true}).nullish(),
      disabled: z.boolean().optional(),
    })
    .openapi({ref: 'Resource'}),
  pipeline: zBase
    .extend({
      id: zId('pipe'),
      // TODO: Remove nullish now that pipelines are more fixed
      sourceId: zId('reso').optional(),
      sourceState: z.record(z.unknown()).optional(),
      destinationId: zId('reso').optional(),
      destinationState: z.record(z.unknown()).optional(),
      linkOptions: z
        .array(z.unknown())
        // z.union([
        //   z.string(),
        //   z.tuple([z.string()]),
        //   z.tuple([z.string(), z.unknown()]),
        // ]),
        .nullish(),
      // TODO: Add two separate tables sync_jobs to keep track of this instead of these two
      // though questionnable whether it should be in a separate database completely
      // just like Airbyte. Or perhaps using airbyte itself as the jobs database
      lastSyncStartedAt: z.date().nullish(),
      lastSyncCompletedAt: z.date().nullish(),
      disabled: z.boolean().optional(),
    })
    .openapi({ref: 'Pipeline'}),
  integration: zBase
    .extend({
      id: zId('int'),
      connectorName: z.string(),
      standard: zStandard.integration.omit({id: true}).nullish(),
      external: z.record(z.unknown()).nullish(),
    })
    .openapi({ref: 'Integration'}),
  // TODO: Add connection_attempts
}
