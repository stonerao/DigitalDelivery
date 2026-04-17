<script setup>
defineOptions({
  name: "ProjectPackageValidation"
});

defineProps({
  report: {
    type: Object,
    default: () => ({
      valid: true,
      errors: 0,
      warnings: 0,
      findings: []
    })
  }
});
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded border border-[var(--el-border-color)] p-4">
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          校验状态
        </div>
        <div class="mt-2 text-xl font-semibold">
          {{ report.valid ? "通过" : "未通过" }}
        </div>
      </div>
      <div class="rounded border border-[var(--el-border-color)] p-4">
        <div class="text-xs text-[var(--el-text-color-secondary)]">错误</div>
        <div class="mt-2 text-xl font-semibold text-[var(--el-color-danger)]">
          {{ report.errors || 0 }}
        </div>
      </div>
      <div class="rounded border border-[var(--el-border-color)] p-4">
        <div class="text-xs text-[var(--el-text-color-secondary)]">警告</div>
        <div class="mt-2 text-xl font-semibold text-[var(--el-color-warning)]">
          {{ report.warnings || 0 }}
        </div>
      </div>
    </div>

    <el-alert
      v-if="report.valid"
      title="当前工程包结构校验通过。"
      type="success"
      :closable="false"
    />

    <div v-if="report.findings?.length" class="space-y-3">
      <div
        v-for="item in report.findings"
        :key="item.id"
        class="rounded border border-[var(--el-border-color)] px-4 py-3"
      >
        <div class="flex items-center justify-between gap-2">
          <el-tag
            :type="item.level === 'error' ? 'danger' : 'warning'"
            size="small"
          >
            {{ item.level }}
          </el-tag>
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            {{ item.path }}
          </span>
        </div>
        <div class="mt-2 text-sm">{{ item.message }}</div>
      </div>
    </div>

    <el-empty v-else description="当前没有发现结构性问题" :image-size="88" />
  </div>
</template>
