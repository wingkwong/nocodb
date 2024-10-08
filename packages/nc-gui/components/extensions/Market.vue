<script lang="ts" setup>
interface Prop {
  modelValue?: boolean
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, addExtension, getExtensionAssetsUrl, showExtensionDetails } = useExtensions()

const searchQuery = ref<string>('')

const filteredAvailableExtensions = computed(() =>
  (availableExtensions.value || []).filter(
    (ext) =>
      ext.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ext.subTitle.toLowerCase().includes(searchQuery.value.toLowerCase()),
  ),
)

const onExtensionClick = (extensionId: string) => {
  showExtensionDetails(extensionId)
  vModel.value = false
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  vModel.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :width="1154"
    size="medium"
    wrap-class-name="nc-modal-extension-market"
  >
    <div class="h-full">
      <div class="flex items-center gap-3 p-4 border-b-1 border-gray-200">
        <GeneralIcon icon="ncPuzzleSolid" class="h-6 w-6 flex-none text-gray-700" />
        <div class="flex-1 font-semibold text-xl">Extensions Marketplace</div>
        <NcButton size="small" type="text" @click="vModel = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>

      <div class="flex flex-col h-[calc(100%_-_65px)] px-6 py-4">
        <div class="h-full flex flex-col gap-6 flex-1 pt-2">
          <div class="flex flex max-w-[470px]">
            <a-input
              v-model:value="searchQuery"
              type="text"
              class="nc-input-border-on-value !h-8 !px-3 !py-1 !rounded-lg"
              placeholder="Search for an extension..."
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
              </template>
            </a-input>
          </div>
          <div
            class="max-h-[calc(100%_-_40px)] flex flex-wrap gap-3 nc-scrollbar-thin pb-2"
            :class="{
              'h-full': searchQuery && !filteredAvailableExtensions.length && availableExtensions.length,
            }"
          >
            <template v-for="ext of filteredAvailableExtensions" :key="ext.id">
              <div
                class="nc-market-extension-item flex border-1 rounded-xl p-3 w-[360px] cursor-pointer hover:bg-gray-50 transition-all"
                @click="onExtensionClick(ext.id)"
              >
                <div class="h-[60px] w-[60px] overflow-hidden m-auto">
                  <img :src="getExtensionAssetsUrl(ext.iconUrl)" alt="icon" class="w-full h-full object-contain" />
                </div>
                <div class="flex flex-grow flex-col gap-1 ml-3">
                  <div class="flex justify-between gap-1">
                    <div class="font-weight-600 text-base">{{ ext.title }}</div>
                    <NcButton size="xsmall" type="secondary" class="!px-7px" @click.stop="onAddExtension(ext)">
                      <div class="flex items-center gap-1 -ml-3px text-small">
                        <GeneralIcon icon="plus" />
                        {{ $t('general.install') }}
                      </div>
                    </NcButton>
                  </div>
                  <div class="w-[250px] h-[32px] text-xs text-gray-500 line-clamp-2">{{ ext.subTitle }}</div>
                </div>
              </div>
            </template>
            <div
              v-if="searchQuery && !filteredAvailableExtensions.length && availableExtensions.length"
              class="w-full h-full flex items-center justify-center"
            >
              <div class="pb-6 text-gray-500 flex flex-col items-center gap-6 text-center">
                <img
                  src="~assets/img/placeholder/no-search-result-found.png"
                  class="!w-[164px] flex-none"
                  alt="No search results found"
                />

                {{ $t('title.noResultsMatchedYourSearch') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-market-extension-item {
  &:hover {
    box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
  }
}
</style>

<style lang="scss">
.nc-modal-extension-market {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }
}
</style>
