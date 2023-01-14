import type { TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { ref, unref, useNuxtApp, watch } from '#imports'

const [useProvideViewsStore, useViewsStore] = useInjectionState((meta: MaybeRef<TableType | undefined>) => {
  // debugger
  // console.log('--------------------useViews--------------------')
  // console.trace()
  const views = ref<ViewType[]>([])
  const isLoading = ref(false)

  const { $api } = useNuxtApp()

  const loadViews = async () => {
    // debugger
    isLoading.value = true
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      const response = (await $api.dbView.list(_meta.id)).list as ViewType[]
      if (response) {
        views.value = response.sort((a, b) => a.order! - b.order!)
      }
    }

    isLoading.value = false
  }

  watch(() => unref(meta), loadViews, { immediate: true })

  return { views, isLoading, loadViews }
}, 'views-store')

export { useProvideViewsStore }

export function useViewsStoreOrThrow() {
  const viewsStore = useViewsStore()

  if (viewsStore == null) throw new Error('Please call `useProvideViewsStore` on the appropriate parent component')

  return viewsStore
}
