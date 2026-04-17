<script setup>
defineOptions({ name: "MediaViewer" });

const props = defineProps({
  url: { type: String, default: "" },
  kind: { type: String, default: "audio" }
});
</script>

<template>
  <div class="dd-media-viewer">
    <template v-if="props.url">
      <audio
        v-if="props.kind === 'audio'"
        :src="props.url"
        controls
        class="dd-media-player"
      >
        当前浏览器不支持音频预览。
      </audio>
      <video v-else :src="props.url" controls class="dd-media-player">
        当前浏览器不支持视频预览。
      </video>
    </template>
    <div v-else class="dd-empty-tip">当前文档缺少可预览地址</div>
  </div>
</template>

<style scoped>
.dd-media-viewer {
  width: 100%;
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.dd-media-player {
  width: 100%;
  max-height: 608px;
}

.dd-empty-tip {
  color: var(--el-text-color-secondary);
}
</style>
