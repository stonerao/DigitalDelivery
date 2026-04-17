<script setup>
import MenuFold from "~icons/ri/menu-fold-fill";
import MenuUnfold from "~icons/ri/menu-unfold-fill";

defineProps({
  isActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["toggleClick"]);

const toggleClick = () => {
  emit("toggleClick");
};
</script>

<template>
  <div
    class="px-3 mr-1 navbar-bg-hover"
    :title="isActive ? '点击折叠' : '点击展开'"
    @click="toggleClick"
  >
    <IconifyIconOffline
      :icon="isActive ? MenuFold : MenuUnfold"
      class="inline-block! align-middle hover:text-primary dark:hover:text-white!"
    />
  </div>
</template>
