'use client'

import type {RealtimePostgresChangesPayload} from '@supabase/realtime-js'
import {RealtimeClient} from '@supabase/realtime-js'
import type {SupabaseClient} from '@supabase/supabase-js'
import React from 'react'

import {commonEnv} from '@usevenice/app-config/commonConfig'
import {trpcReact} from '@usevenice/engine-frontend'
import {joinPath} from '@usevenice/util'

import type {Database} from '../supabase/supabase.gen'

// https://db-dev.venice.is
// wss://db-dev.venice.is/realtime/v1/websocket

export function createRealtimeClient() {
  return new RealtimeClient(
    joinPath(
      commonEnv.NEXT_PUBLIC_SUPABASE_URL.replace('https', 'wss'),
      'realtime/v1',
    ),
    {params: {apikey: commonEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}},
  )
}

export function subscribePostgresChanges(
  client: SupabaseClient | RealtimeClient,
  tableName: keyof Database['public']['Tables'],
  fn: (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
) {
  const sub = client
    // Unique channel name otherwise multiple calls to subscribe would overwrite each other
    .channel(`pg/public.${tableName}.${Date.now()}`)
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: tableName},
      (change) => {
        console.log(`[postgres_changes] public.${tableName}`, change)
        fn(change)
      },
    )
    .subscribe()
  console.log(`[postgres_changes] Sub public.${tableName}`)
  return {
    ...sub,
    unsub: () => {
      console.log(`[postgres_changes] Unsub public.${tableName}`)
      void sub.unsubscribe()
    },
  }
}

// MARK: - React

/** Ties to component lifecycle. Prefer global ones for subscription */
export function usePostgresChanges(
  client: SupabaseClient | RealtimeClient,
  tableName: keyof Database['public']['Tables'],
  fn: (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
) {
  React.useEffect(() => subscribePostgresChanges(client, tableName, fn).unsub)
}

export const InvalidateQueriesOnPostgresChanges = React.memo(
  function InvalidateQueriesOnPostgresChanges(props: {
    client: RealtimeClient | SupabaseClient
  }) {
    const trpcUtils = trpcReact.useContext()
    console.log('InvalidateQueriesOnPostgresChanges')
    const invalidate = React.useCallback(() => {
      void trpcUtils.listConnections.invalidate()
      void trpcUtils.listPipelines.invalidate()
    }, [trpcUtils])
    usePostgresChanges(props.client, 'resource', () => {
      console.log('invalidate resources and related')
      void trpcUtils.listResources.invalidate()
      invalidate()
    })
    usePostgresChanges(props.client, 'pipeline', () => {
      console.log('invalidate pipelines and related')
      void trpcUtils.listPipelines2.invalidate()
      invalidate()
    })
    usePostgresChanges(props.client, 'integration', () => {
      console.log('invalidate integrations and related')
      void trpcUtils.adminListIntegrations.invalidate()
      void trpcUtils.listIntegrationInfos.invalidate()
    })
    return null
  },
)