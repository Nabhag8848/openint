'use client'

import {adminRouterSchema} from '@usevenice/engine-backend/router/adminRouter'
import {_trpcReact} from '@usevenice/engine-frontend'
import {SchemaForm, useToast} from '@usevenice/ui'

import {copyToClipboard} from '@/lib-client/copyToClipboard'

export default function MagicLinkPage() {
  const {toast} = useToast()

  const createMagicLink = _trpcReact.adminCreateMagicLink.useMutation({
    onError: (err) => {
      toast({
        title: 'Error creating magic link',
        description: `${err.message}`,
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">Magic link</h2>
      <SchemaForm
        schema={adminRouterSchema.adminCreateMagicLink.input}
        loading={createMagicLink.isLoading}
        onSubmit={({formData: values}) => {
          createMagicLink.mutate(values, {
            onSuccess: async (data) => {
              await copyToClipboard(data.url)
              toast({
                title: 'Magic link copied to clipboard',
                variant: 'success',
              })
            },
          })
        }}
      />
    </div>
  )
}
