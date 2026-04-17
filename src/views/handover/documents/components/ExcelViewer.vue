<script setup>
import { computed, ref, watch } from "vue";
import * as XLSX from "xlsx";

defineOptions({ name: "ExcelViewer" });

const MAX_PREVIEW_ROWS = 500;
const MAX_PREVIEW_COLS = 50;

const props = defineProps({
  url: { type: String, default: "" },
  name: { type: String, default: "" }
});

const loading = ref(false);
const error = ref("");
const workbookSheets = ref([]);
const activeSheetName = ref("");

const activeSheet = computed(() => {
  return (
    workbookSheets.value.find(sheet => sheet.name === activeSheetName.value) ||
    workbookSheets.value[0] ||
    null
  );
});

const visibleColumnCount = computed(() => {
  return activeSheet.value?.previewColCount || 0;
});

const columnHeaders = computed(() => {
  return Array.from({ length: visibleColumnCount.value }, (_, index) =>
    formatColumnLabel(index)
  );
});

let loadToken = 0;

function formatColumnLabel(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function normalizeCell(value) {
  if (value == null) return "";
  return String(value);
}

function buildSheetPreview(name, worksheet) {
  const range = worksheet?.["!ref"]
    ? XLSX.utils.decode_range(worksheet["!ref"])
    : null;
  const totalRows = range ? range.e.r + 1 : 0;
  const totalCols = range ? range.e.c + 1 : 0;
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ""
  });
  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS).map(row => {
    return Array.from(
      { length: Math.min(MAX_PREVIEW_COLS, row.length) },
      (_, i) => normalizeCell(row[i])
    );
  });

  return {
    name,
    totalRows,
    totalCols,
    previewRows,
    previewColCount: Math.min(totalCols, MAX_PREVIEW_COLS),
    truncatedRows: totalRows > MAX_PREVIEW_ROWS,
    truncatedCols: totalCols > MAX_PREVIEW_COLS
  };
}

async function loadWorkbook(url) {
  const currentToken = ++loadToken;
  loading.value = true;
  error.value = "";
  workbookSheets.value = [];
  activeSheetName.value = "";
  try {
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Excel 文件加载失败");
    }
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    if (currentToken !== loadToken) return;

    const sheets = (workbook.SheetNames || []).map(sheetName =>
      buildSheetPreview(sheetName, workbook.Sheets?.[sheetName])
    );
    workbookSheets.value = sheets;
    activeSheetName.value = sheets[0]?.name || "";
    if (!sheets.length) {
      error.value = "当前 Excel 文件没有可预览的工作表";
    }
  } catch (e) {
    if (currentToken !== loadToken) return;
    error.value = e?.message || "Excel 文件解析失败";
  } finally {
    if (currentToken === loadToken) {
      loading.value = false;
    }
  }
}

watch(
  () => props.url,
  url => {
    loadWorkbook(url);
  },
  { immediate: true }
);
</script>

<template>
  <div class="dd-excel-viewer">
    <div
      v-if="loading"
      class="dd-excel-tip text-[var(--el-text-color-secondary)]"
    >
      正在解析 Excel 文件...
    </div>
    <div v-else-if="error" class="dd-excel-tip text-[var(--el-color-danger)]">
      {{ error }}
    </div>
    <div v-else-if="activeSheet" class="dd-excel-content">
      <div class="dd-excel-meta">
        <div class="dd-excel-name">{{ props.name || "Excel 预览" }}</div>
        <div class="dd-excel-summary">
          工作表 {{ workbookSheets.length }} 个，当前 {{ activeSheet.name }}，共
          {{ activeSheet.totalRows }} 行 / {{ activeSheet.totalCols }} 列
        </div>
      </div>

      <div v-if="workbookSheets.length > 1" class="dd-excel-tabs">
        <el-segmented
          v-model="activeSheetName"
          :options="workbookSheets.map(sheet => sheet.name)"
        />
      </div>

      <div
        v-if="activeSheet.truncatedRows || activeSheet.truncatedCols"
        class="dd-excel-notice"
      >
        当前仅预览前 {{ MAX_PREVIEW_ROWS }} 行、前
        {{ MAX_PREVIEW_COLS }} 列，请下载查看完整文件。
      </div>

      <div class="dd-excel-table-wrap">
        <table class="dd-excel-table">
          <thead>
            <tr>
              <th class="dd-excel-index">#</th>
              <th v-for="header in columnHeaders" :key="header">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in activeSheet.previewRows"
              :key="`${activeSheet.name}-${rowIndex}`"
            >
              <td class="dd-excel-index">{{ rowIndex + 1 }}</td>
              <td
                v-for="(_, colIndex) in columnHeaders"
                :key="`${activeSheet.name}-${rowIndex}-${colIndex}`"
                :title="row[colIndex] || ''"
              >
                {{ row[colIndex] || "" }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="dd-excel-tip text-[var(--el-text-color-secondary)]">
      当前 Excel 文件没有可预览内容。
    </div>
  </div>
</template>

<style scoped>
.dd-excel-viewer {
  width: 100%;
}

.dd-excel-tip {
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  text-align: center;
}

.dd-excel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dd-excel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: baseline;
}

.dd-excel-name {
  font-size: 14px;
  font-weight: 600;
}

.dd-excel-summary,
.dd-excel-notice {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dd-excel-tabs {
  overflow-x: auto;
}

.dd-excel-table-wrap {
  max-height: 640px;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.dd-excel-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.dd-excel-table th,
.dd-excel-table td {
  min-width: 120px;
  max-width: 240px;
  padding: 8px 10px;
  border-right: 1px solid var(--el-border-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  vertical-align: top;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-excel-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.dd-excel-index {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 64px !important;
  max-width: 64px !important;
  text-align: center;
  background: var(--el-fill-color-light);
}

.dd-excel-table thead .dd-excel-index {
  z-index: 3;
}
</style>
