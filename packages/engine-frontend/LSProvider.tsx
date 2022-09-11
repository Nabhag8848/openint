import {createReactQueryHooks} from '@trpc/react'
import React from 'react'

import type {
  AnySyncProvider,
  DialogConfig,
  LinkFactory,
} from '@ledger-sync/cdk-core'
import type {
  makeSyncEngine,
  SyncEngineConfig,
} from '@ledger-sync/engine-backend'
import {R} from '@ledger-sync/util'

import type {DialogInstance} from './components/Dialog'
import {Dialog} from './components/Dialog'

type Router = ReturnType<typeof makeSyncEngine>[1]
const trpc = createReactQueryHooks<Router>()

export const LSContext = React.createContext<{
  trpc: typeof trpc
  client: ReturnType<typeof trpc.createClient>
  // TODO: get the proper types from cdk-core
  hooks: Record<string, ((input: any, ctx: any) => Promise<any>) | undefined>
} | null>(null)

export function LSProvider<
  T extends AnySyncProvider[],
  TLinks extends Record<string, LinkFactory>,
>({
  children,
  config,
  queryClient,
}: {
  children: React.ReactNode
  config: SyncEngineConfig<T, TLinks>
  queryClient: Parameters<typeof trpc.Provider>[0]['queryClient']
}) {
  const routerUrl = config.routerUrl ?? '/api/ledger-sync'
  const client = trpc.createClient({url: routerUrl})

  const dialogRef = React.useRef<DialogInstance>(null)
  const [dialogConfig, setDialogConfig] = React.useState<DialogConfig | null>(
    null,
  )

  const hooks = R.mapToObj(config.providers, (p) => [
    p.name,
    p.useConnectHook?.({
      openDialog: (render, options) => {
        setDialogConfig({Component: render, options})
        dialogRef.current?.open()
      },
    }),
  ])

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <LSContext.Provider value={{trpc, hooks, client}}>
        {children}

        {dialogConfig && (
          <Dialog
            ref={dialogRef}
            modal // TODO: Modal is true by default, but dialog still auto-dismiss on press outside...
            open
            onOpenChange={(newOpen) => {
              console.log('Dialog.onOpenChange', {newOpen})
              if (!newOpen) {
                dialogConfig.options?.onClose?.()
                setDialogConfig(null)
              }
            }}>
            <dialogConfig.Component close={() => dialogRef.current?.close()} />
          </Dialog>
        )}
      </LSContext.Provider>
    </trpc.Provider>
  )
}

/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
LSProvider.useContext = () => React.useContext(LSContext)!

// TODO: Figure out how to work with NextJS SSR here
// adding typeof withTRPC<Router> breaks prettier, let's figure it out...
// const withLedgerSync = (options: Parameters<typeof withTRPC>[0]) =>
//   withTRPC({
//     ...options,
//     // Improve typing to omit options.config.url, it is a noop
//     config: (info) => ({...options.config(info), url: routerUrl}),
//   })
