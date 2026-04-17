import { defineStore } from "pinia";
import { store } from "../utils";
import { encryptToVault, removeVault } from "@/utils/docVault";

const baseUrl = import.meta.env.BASE_URL || "/";
const demoModelUrl = `${baseUrl}model/test.glb`;

function safeCreateObjectUrl(fileLike) {
  try {
    const raw = fileLike?.raw || fileLike;
    if (typeof window === "undefined") return "";
    if (!window.URL?.createObjectURL) return "";
    if (raw instanceof Blob) return window.URL.createObjectURL(raw);
  } catch {
    // ignore
  }
  return "";
}

function nowText() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function todayText() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function upperExt(name) {
  const ext = name && name.includes(".") ? name.split(".").pop() : "";
  return ext ? ext.toUpperCase() : "文件";
}

function normalizeDocType(name, fallback) {
  const ext = upperExt(name);
  if (ext === "JPG" || ext === "JPEG" || ext === "PNG" || ext === "GIF")
    return "IMAGE";
  if (ext === "PDF") return "PDF";
  if (ext === "DOC" || ext === "DOCX") return "WORD";
  if (ext === "XLS" || ext === "XLSX") return "EXCEL";
  if (ext === "PPT" || ext === "PPTX") return "PPT";
  if (ext === "TXT" || ext === "MD") return "TEXT";
  if (ext === "DWG") return "DWG";
  if (ext === "RVT") return "RVT";
  return fallback || ext;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function ensureDocShape(doc) {
  if (!doc) return doc;
  if (!Array.isArray(doc.versions) || doc.versions.length === 0) {
    doc.versions = [
      {
        id: newId("ver"),
        name: doc.name,
        size: doc.size ?? 0,
        type: doc.type,
        url: doc.url || "",
        vaultRef: doc.vaultRef || "",
        mime: doc.mime || "",
        uploadedAt: doc.updatedAt || todayText(),
        uploadedBy: doc.updatedBy || doc.createdBy || "-",
        note: "初始版本"
      }
    ];
  }
  if (!doc.folderId) doc.folderId = "root";
  if (!doc.createdAt) doc.createdAt = doc.updatedAt || todayText();
  if (!doc.createdBy) doc.createdBy = "-";
  if (!doc.updatedBy) doc.updatedBy = "-";
  if (doc.deletedAt === undefined) doc.deletedAt = "";
  if (doc.deletedBy === undefined) doc.deletedBy = "";
  return doc;
}

function flattenTree(tree) {
  const out = [];
  const walk = (nodes, parentId = "") => {
    (nodes || []).forEach(n => {
      out.push({ id: n.id, label: n.label, parentId });
      if (n.children?.length) walk(n.children, n.id);
    });
  };
  walk(tree);
  return out;
}

/**
 * 统一联动数据源：系统节点、KKS台账、文档、模型、数据版本、关系边
 * 目标：支持按 KKS 串联 与 按 系统节点 串联
 */
export const useDdLinkageStore = defineStore("dd-linkage", {
  state: () => ({
    systemTree: [
      {
        id: "sys-1",
        label: "锅炉系统",
        children: [
          { id: "sys-1-1", label: "给水泵系统（10LAC10）" },
          { id: "sys-1-2", label: "燃烧系统（10LBA）" }
        ]
      },
      {
        id: "sys-2",
        label: "电气系统",
        children: [
          { id: "sys-2-1", label: "厂用电系统（10EAA）" },
          { id: "sys-2-2", label: "DCS控制系统（10HAA）" }
        ]
      }
    ],
    nodeMeta: {
      "sys-1-1": {
        systemName: "给水泵系统",
        discipline: "热机",
        scope: "锅炉岛 / 给水泵与阀门回路",
        owner: "专业负责人：张三",
        description:
          "系统用于锅炉给水输送与压力维持，包含主给水泵、阀门、测点与相关回路，可联动文档/模型/设备台账。",
        kksRoot: "10LAC10"
      },
      "sys-1-2": {
        systemName: "燃烧系统",
        discipline: "热机",
        scope: "锅炉岛 / 燃烧与风烟系统",
        owner: "专业负责人：李四",
        description: "燃烧与风烟相关系统节点（演示数据）。",
        kksRoot: "10LBA"
      },
      "sys-2-2": {
        systemName: "DCS控制系统",
        discipline: "电仪",
        scope: "控制室 / 自动化",
        owner: "专业负责人：王五",
        description: "DCS 控制系统节点（演示数据）。",
        kksRoot: "10HAA"
      }
    },
    kksItems: [
      {
        kks: "10LAC10",
        name: "锅炉给水泵系统",
        type: "系统",
        status: "已校验",
        nodeId: "sys-1-1"
      },
      {
        kks: "10LAC10AP001",
        name: "主给水泵A",
        type: "设备",
        status: "待校验",
        nodeId: "sys-1-1"
      },
      {
        kks: "10LAC10AP002",
        name: "主给水泵B",
        type: "设备",
        status: "待校验",
        nodeId: "sys-1-1"
      },
      {
        kks: "10HAA00DS001",
        name: "DCS机柜",
        type: "设备",
        status: "已校验",
        nodeId: "sys-2-2"
      }
    ],
    documents: [
      {
        id: "doc-1",
        name: "锅炉系统P&ID图.pdf",
        size: 2.4 * 1024 * 1024,
        updatedAt: "2024-01-15",
        type: "PDF",
        url: "",
        createdAt: "2024-01-15",
        createdBy: "系统",
        updatedBy: "系统",
        deletedAt: "",
        deletedBy: "",
        folderId: "root",
        versions: [],
        nodeIds: ["sys-1-1"],
        kksRefs: ["10LAC10"]
      },
      {
        id: "doc-2",
        name: "设备数据表.xlsx",
        size: 1.2 * 1024 * 1024,
        updatedAt: "2024-01-14",
        type: "EXCEL",
        url: "",
        createdAt: "2024-01-14",
        createdBy: "系统",
        updatedBy: "系统",
        deletedAt: "",
        deletedBy: "",
        folderId: "root",
        versions: [],
        nodeIds: ["sys-1-1"],
        kksRefs: ["10LAC10AP001"]
      }
    ],
    docFolders: [
      {
        id: "root",
        label: "全部文档",
        parentId: "",
        order: 0
      }
    ],
    docAuditLogs: [],
    models: [
      {
        id: "m-1",
        icon: "🏭",
        name: "锅炉系统模型",
        url: demoModelUrl,
        lod: "LOD400",
        components: 1254,
        updatedAt: "2024-01-13",
        nodeIds: ["sys-1-1"],
        kksRefs: ["10LAC10"]
      },
      {
        id: "m-2",
        icon: "💨",
        name: "烟气处理系统",
        url: demoModelUrl,
        lod: "LOD350",
        components: 892,
        updatedAt: "2024-01-12",
        nodeIds: ["sys-1-2"],
        kksRefs: ["10LBA"]
      },
      {
        id: "m-3",
        icon: "⚡",
        name: "电气控制系统",
        url: demoModelUrl,
        lod: "LOD300",
        components: 567,
        updatedAt: "2024-01-11",
        nodeIds: ["sys-2-2"],
        kksRefs: ["10HAA"]
      }
    ],
    deviceProfiles: [
      {
        kks: "10LAC10AP001",
        nodeId: "sys-1-1",
        name: "主给水泵A",
        systemName: "给水泵系统",
        ledgerNo: "FDP-A-001",
        manufacturer: "上海电机厂",
        model: "DG120-50",
        ratedPower: "6.3MW",
        ratedVoltage: "6kV",
        medium: "除氧给水",
        functionDesc: "承担锅炉主给水输送任务，维持给水压力与流量稳定。",
        structureParams: [
          { label: "叶轮级数", value: "8 级" },
          { label: "设计扬程", value: "510m" },
          { label: "额定流量", value: "1180t/h" },
          { label: "密封形式", value: "机械密封" }
        ],
        runningParams: [
          { label: "出口压力", value: "16.2", unit: "MPa", status: "normal" },
          { label: "入口温度", value: "156", unit: "℃", status: "normal" },
          { label: "轴承温度", value: "71", unit: "℃", status: "warning" },
          { label: "电机电流", value: "612", unit: "A", status: "normal" }
        ]
      },
      {
        kks: "10LAC10AP002",
        nodeId: "sys-1-1",
        name: "主给水泵B",
        systemName: "给水泵系统",
        ledgerNo: "FDP-B-002",
        manufacturer: "哈尔滨电机厂",
        model: "DG120-50B",
        ratedPower: "6.3MW",
        ratedVoltage: "6kV",
        medium: "除氧给水",
        functionDesc: "作为主给水泵A的备用/并列机组，支撑锅炉给水稳定运行。",
        structureParams: [
          { label: "叶轮级数", value: "8 级" },
          { label: "设计扬程", value: "505m" },
          { label: "额定流量", value: "1180t/h" },
          { label: "密封形式", value: "机械密封" }
        ],
        runningParams: [
          { label: "出口压力", value: "15.8", unit: "MPa", status: "normal" },
          { label: "入口温度", value: "155", unit: "℃", status: "normal" },
          { label: "轴承温度", value: "63", unit: "℃", status: "normal" },
          { label: "电机电流", value: "588", unit: "A", status: "normal" }
        ]
      },
      {
        kks: "10HAA00DS001",
        nodeId: "sys-2-2",
        name: "DCS机柜",
        systemName: "DCS控制系统",
        ledgerNo: "DCS-CAB-001",
        manufacturer: "和利时",
        model: "MACS V6",
        ratedPower: "4kW",
        ratedVoltage: "220V",
        medium: "控制信号",
        functionDesc: "实现机组监视、报警、控制逻辑执行及历史数据采集。",
        structureParams: [
          { label: "控制器数量", value: "4 台" },
          { label: "I/O 点数", value: "3200 点" },
          { label: "通讯方式", value: "工业以太网" },
          { label: "冗余形式", value: "控制器/电源双冗余" }
        ],
        runningParams: [
          { label: "CPU负荷", value: "38", unit: "%", status: "normal" },
          { label: "柜内温度", value: "29", unit: "℃", status: "normal" },
          { label: "网络延迟", value: "12", unit: "ms", status: "normal" },
          { label: "报警数量", value: "2", unit: "条", status: "warning" }
        ]
      }
    ],
    measurementPoints: [
      {
        id: "pt-1",
        kks: "10LAC10AP001",
        tag: "PT-101",
        name: "出口压力测点",
        unit: "MPa",
        value: "16.2",
        status: "normal",
        description: "主给水泵A出口压力"
      },
      {
        id: "pt-2",
        kks: "10LAC10AP001",
        tag: "TT-102",
        name: "轴承温度测点",
        unit: "℃",
        value: "71",
        status: "warning",
        description: "主给水泵A驱动端轴承温度"
      },
      {
        id: "pt-3",
        kks: "10LAC10AP002",
        tag: "PT-201",
        name: "出口压力测点",
        unit: "MPa",
        value: "15.8",
        status: "normal",
        description: "主给水泵B出口压力"
      },
      {
        id: "pt-4",
        kks: "10HAA00DS001",
        tag: "NT-301",
        name: "网络延迟测点",
        unit: "ms",
        value: "12",
        status: "normal",
        description: "DCS主控网络延迟"
      }
    ],
    dataVersions: [
      {
        id: "v-1",
        name: "设备台账-初版.xlsx",
        time: "2024-01-15 10:30",
        note: "初始导入"
      }
    ],
    relations: [
      // 节点 <-> 文档
      {
        id: "r1",
        type: "node_doc",
        source: { kind: "node", id: "sys-1-1" },
        target: { kind: "doc", id: "doc-2" },
        updatedAt: "2026-01-01 10:12"
      },
      // 节点 <-> 模型
      {
        id: "r2",
        type: "node_model",
        source: { kind: "node", id: "sys-1-1" },
        target: { kind: "model", id: "m-1" },
        updatedAt: "2026-01-01 10:18"
      },
      // KKS <-> 文档
      {
        id: "r3",
        type: "kks_doc",
        source: { kind: "kks", id: "10LAC10AP001" },
        target: { kind: "doc", id: "doc-2" },
        updatedAt: "2026-01-02 09:00"
      },
      // KKS <-> 模型
      {
        id: "r4",
        type: "kks_model",
        source: { kind: "kks", id: "10LAC10AP001" },
        target: { kind: "model", id: "m-1" },
        updatedAt: "2026-01-02 09:05"
      }
    ]
  }),
  getters: {
    nodeOptions(state) {
      return flattenTree(state.systemTree)
        .filter(n => n.id !== "sys-1" && n.id !== "sys-2")
        .map(n => ({ label: n.label, value: n.id }));
    },
    kksOptions(state) {
      return state.kksItems.map(i => ({
        label: `${i.name}（${i.kks}）`,
        value: i.kks
      }));
    },
    docOptions(state) {
      return state.documents.map(d => ({ label: d.name, value: d.id }));
    },
    modelOptions(state) {
      return state.models.map(m => ({ label: m.name, value: m.id }));
    },
    relTypeOptions() {
      return [
        { label: "节点-文档", value: "node_doc" },
        { label: "节点-模型", value: "node_model" },
        { label: "KKS-文档", value: "kks_doc" },
        { label: "KKS-模型", value: "kks_model" }
      ];
    }
  },
  actions: {
    initDocuments() {
      // 兼容旧数据：补齐字段
      this.documents = (this.documents || []).map(d => ensureDocShape(d));
    },
    addDocAuditLog({ action, actor, docId, detail }) {
      this.docAuditLogs.unshift({
        id: newId("log"),
        time: nowText(),
        action: action || "-",
        actor: actor || "-",
        docId: docId || "",
        detail: detail || ""
      });
    },
    getNodeLabel(nodeId) {
      return (
        flattenTree(this.systemTree).find(n => n.id === nodeId)?.label || nodeId
      );
    },
    getKksLabel(kks) {
      const hit = this.kksItems.find(i => i.kks === kks);
      return hit ? `${hit.name}（${hit.kks}）` : kks;
    },
    getDocById(id) {
      return this.documents.find(d => d.id === id) || null;
    },

    getFolderById(id) {
      return (this.docFolders || []).find(f => f.id === id) || null;
    },

    listFolders() {
      return [...(this.docFolders || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
    },

    createFolder({ label, parentId = "root" }) {
      const name = String(label || "").trim();
      if (!name) return null;
      const parent = this.getFolderById(parentId) ? parentId : "root";
      const siblings = (this.docFolders || []).filter(
        f => f.parentId === parent
      );
      const nextOrder = siblings.length
        ? Math.max(...siblings.map(s => s.order ?? 0)) + 1
        : 1;
      const item = {
        id: newId("fld"),
        label: name,
        parentId: parent,
        order: nextOrder
      };
      this.docFolders.push(item);
      return item;
    },

    renameFolder(id, label) {
      const hit = this.getFolderById(id);
      if (!hit || hit.id === "root") return;
      const name = String(label || "").trim();
      if (!name) return;
      hit.label = name;
    },

    moveFolder(id, parentId) {
      const hit = this.getFolderById(id);
      if (!hit || hit.id === "root") return;
      const targetParent = this.getFolderById(parentId) ? parentId : "root";
      if (hit.parentId === targetParent) return;
      hit.parentId = targetParent;
    },

    deleteFolder(id) {
      const hit = this.getFolderById(id);
      if (!hit || hit.id === "root") return false;
      const hasChildren = (this.docFolders || []).some(f => f.parentId === id);
      const hasDocs = (this.documents || []).some(
        d => (d.folderId || "root") === id
      );
      if (hasChildren || hasDocs) return false;
      this.docFolders = (this.docFolders || []).filter(f => f.id !== id);
      return true;
    },

    exportFolderTree() {
      return JSON.stringify({ folders: this.docFolders || [] }, null, 2);
    },

    importFolderTree(payload) {
      try {
        const data =
          typeof payload === "string" ? JSON.parse(payload) : payload;
        const folders = Array.isArray(data?.folders) ? data.folders : [];
        const normalized = folders
          .filter(f => f && f.id && f.label)
          .map(f => ({
            id: String(f.id),
            label: String(f.label),
            parentId: String(f.parentId || "root"),
            order: Number.isFinite(f.order) ? f.order : 0
          }));
        // 确保 root
        const hasRoot = normalized.some(f => f.id === "root");
        this.docFolders = hasRoot
          ? normalized
          : [
              { id: "root", label: "全部文档", parentId: "", order: 0 },
              ...normalized
            ];
        // 修正非法 parent
        const ids = new Set(this.docFolders.map(f => f.id));
        this.docFolders.forEach(f => {
          if (f.id !== "root" && !ids.has(f.parentId)) f.parentId = "root";
        });
        // 修正文档 folderId
        this.documents.forEach(d => {
          ensureDocShape(d);
          if (!ids.has(d.folderId)) d.folderId = "root";
        });
        return true;
      } catch {
        return false;
      }
    },
    getModelById(id) {
      return this.models.find(m => m.id === id) || null;
    },
    getNodeDetail(nodeId) {
      const meta = this.nodeMeta?.[nodeId] || {};
      const kksRoot = meta.kksRoot || "-";

      const docs = this.getDocsForNode(nodeId);
      const models = this.getModelsForNode(nodeId);
      const devices = this.kksItems
        .filter(i => i.nodeId === nodeId && i.type === "设备")
        .map(i => ({ kks: i.kks, name: i.name }));

      return {
        nodeId,
        label: this.getNodeLabel(nodeId),
        systemName: meta.systemName || "系统节点",
        discipline: meta.discipline || "综合",
        scope: meta.scope || "示例范围",
        owner: meta.owner || "负责人：待定",
        description:
          meta.description ||
          "该节点为原型演示数据：后续可由后端返回系统档案与关联资源。",
        kksRoot,
        docs,
        models,
        devices
      };
    },
    getDocsForNode(nodeId) {
      const direct = this.documents.filter(d =>
        (d.nodeIds || []).includes(nodeId)
      );
      const fromRel = this.relations
        .filter(r => r.type === "node_doc" && r.source.id === nodeId)
        .map(r => this.getDocById(r.target.id))
        .filter(Boolean);
      const merged = [...direct, ...fromRel];
      const unique = new Map(merged.map(d => [d.id, d]));
      return Array.from(unique.values());
    },
    getModelsForNode(nodeId) {
      const direct = this.models.filter(m =>
        (m.nodeIds || []).includes(nodeId)
      );
      const fromRel = this.relations
        .filter(r => r.type === "node_model" && r.source.id === nodeId)
        .map(r => this.getModelById(r.target.id))
        .filter(Boolean);
      const merged = [...direct, ...fromRel];
      const unique = new Map(merged.map(m => [m.id, m]));
      return Array.from(unique.values());
    },
    getDocsForKks(kks) {
      const direct = this.documents.filter(d =>
        (d.kksRefs || []).includes(kks)
      );
      const fromRel = this.relations
        .filter(r => r.type === "kks_doc" && r.source.id === kks)
        .map(r => this.getDocById(r.target.id))
        .filter(Boolean);
      const merged = [...direct, ...fromRel];
      const unique = new Map(merged.map(d => [d.id, d]));
      return Array.from(unique.values());
    },
    getModelsForKks(kks) {
      const direct = this.models.filter(m => (m.kksRefs || []).includes(kks));
      const fromRel = this.relations
        .filter(r => r.type === "kks_model" && r.source.id === kks)
        .map(r => this.getModelById(r.target.id))
        .filter(Boolean);
      const merged = [...direct, ...fromRel];
      const unique = new Map(merged.map(m => [m.id, m]));
      return Array.from(unique.values());
    },
    getDeviceProfileByKks(kks) {
      return this.deviceProfiles.find(item => item.kks === kks) || null;
    },
    getMeasurementPointsByKks(kks) {
      return this.measurementPoints.filter(item => item.kks === kks);
    },
    addDocumentFromUpload(file, meta = {}) {
      const name = file?.name || file?.raw?.name || "未命名文件";
      const url = safeCreateObjectUrl(file);
      const item = {
        id: newId("doc"),
        name,
        size: file?.size ?? file?.raw?.size ?? 0,
        updatedAt: todayText(),
        type: normalizeDocType(name, upperExt(name)),
        url,
        createdAt: todayText(),
        createdBy: meta.actor || "-",
        updatedBy: meta.actor || "-",
        deletedAt: "",
        deletedBy: "",
        folderId: meta.folderId || "root",
        versions: [],
        nodeIds: meta.nodeIds || [],
        kksRefs: meta.kksRefs || []
      };
      ensureDocShape(item);
      this.documents.unshift(item);
      this.addDocAuditLog({
        action: "upload",
        actor: meta.actor || "-",
        docId: item.id,
        detail: `上传文档：${item.name}`
      });
      return item;
    },

    async addDocumentFromUploadEncrypted(file, meta = {}) {
      const item = this.addDocumentFromUpload(file, meta);
      // 以“版本维度”存储加密内容，确保预览/下载不依赖 blob: 明文 URL
      ensureDocShape(item);
      const latest = item.versions?.[0];
      if (!latest) return item;
      try {
        const encrypted = await encryptToVault({
          username: meta.actor || "anonymous",
          docId: item.id,
          versionId: latest.id,
          fileLike: file
        });
        latest.vaultRef = encrypted.vaultRef;
        latest.mime = encrypted.mime;
        latest.url = "";
        // 清理明文 URL 引用（历史兼容字段）
        item.url = "";
      } catch {
        // 失败时回退为明文 blob URL（原型容错）
        latest.url = safeCreateObjectUrl(file);
        item.url = latest.url;
      }
      return item;
    },
    updateDocument(id, patch, meta = {}) {
      const idx = this.documents.findIndex(d => d.id === id);
      if (idx < 0) return;
      ensureDocShape(this.documents[idx]);
      Object.assign(this.documents[idx], patch, {
        updatedAt: todayText(),
        updatedBy: meta.actor || this.documents[idx].updatedBy || "-"
      });
      this.addDocAuditLog({
        action: "update",
        actor: meta.actor || "-",
        docId: id,
        detail: `更新文档元数据：${this.documents[idx].name}`
      });
    },

    moveDocument(id, folderId, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return false;
      ensureDocShape(doc);
      const target = this.getFolderById(folderId) ? folderId : "root";
      if ((doc.folderId || "root") === target) return true;
      doc.folderId = target;
      doc.updatedAt = todayText();
      doc.updatedBy = meta.actor || doc.updatedBy || "-";
      this.addDocAuditLog({
        action: "move",
        actor: meta.actor || "-",
        docId: id,
        detail: `移动文档：${doc.name} -> ${this.getFolderById(target)?.label || target}`
      });
      return true;
    },

    rollbackDocumentToVersion(id, versionId, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return false;
      ensureDocShape(doc);
      const versions = Array.isArray(doc.versions) ? doc.versions : [];
      const idx = versions.findIndex(v => v.id === versionId);
      if (idx < 0) return false;

      const [ver] = versions.splice(idx, 1);
      versions.unshift(ver);
      doc.versions = versions;

      doc.name = ver.name || doc.name;
      doc.size = ver.size ?? doc.size;
      doc.type = ver.type || doc.type;
      doc.url = ver.url || "";
      doc.updatedAt = todayText();
      doc.updatedBy = meta.actor || doc.updatedBy || "-";

      this.addDocAuditLog({
        action: "rollback",
        actor: meta.actor || "-",
        docId: id,
        detail: `回滚版本：${doc.name}（${ver.uploadedAt || "-"}）`
      });
      return true;
    },

    addDocumentVersion(id, file, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return null;
      ensureDocShape(doc);
      const name = file?.name || file?.raw?.name || doc.name;
      const url = safeCreateObjectUrl(file) || doc.url || "";
      const ver = {
        id: newId("ver"),
        name,
        size: file?.size ?? file?.raw?.size ?? doc.size ?? 0,
        type: normalizeDocType(name, doc.type),
        url,
        vaultRef: "",
        mime: "",
        uploadedAt: todayText(),
        uploadedBy: meta.actor || "-",
        note: meta.note || "版本更新"
      };
      doc.versions.unshift(ver);
      // 当前指向最新版本
      doc.name = name;
      doc.size = ver.size;
      doc.type = ver.type;
      doc.url = ver.url;
      doc.updatedAt = todayText();
      doc.updatedBy = meta.actor || doc.updatedBy || "-";
      this.addDocAuditLog({
        action: "version",
        actor: meta.actor || "-",
        docId: id,
        detail: `新增版本：${name}`
      });
      return ver;
    },

    async addDocumentVersionEncrypted(id, file, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return null;
      const ver = this.addDocumentVersion(id, file, meta);
      if (!ver) return null;
      try {
        const encrypted = await encryptToVault({
          username: meta.actor || "anonymous",
          docId: id,
          versionId: ver.id,
          fileLike: file
        });
        ver.vaultRef = encrypted.vaultRef;
        ver.mime = encrypted.mime;
        ver.url = "";
        // 当前指向最新版本
        doc.url = "";
      } catch {
        ver.url = safeCreateObjectUrl(file) || "";
        doc.url = ver.url;
      }
      return ver;
    },

    softDeleteDocument(id, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return;
      ensureDocShape(doc);
      if (doc.deletedAt) return;
      doc.deletedAt = nowText();
      doc.deletedBy = meta.actor || "-";
      this.addDocAuditLog({
        action: "delete",
        actor: meta.actor || "-",
        docId: id,
        detail: `软删除：${doc.name}`
      });
    },

    restoreDocument(id, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return;
      ensureDocShape(doc);
      if (!doc.deletedAt) return;
      doc.deletedAt = "";
      doc.deletedBy = "";
      doc.updatedAt = todayText();
      doc.updatedBy = meta.actor || doc.updatedBy || "-";
      this.addDocAuditLog({
        action: "restore",
        actor: meta.actor || "-",
        docId: id,
        detail: `恢复：${doc.name}`
      });
    },

    purgeDocument(id, meta = {}) {
      const doc = this.getDocById(id);
      if (!doc) return false;
      // 仅允许回收站内彻底删除（避免误删）
      if (!doc.deletedAt) return false;

      // 清理加密存储
      const versions = Array.isArray(doc.versions) ? doc.versions : [];
      versions.forEach(v => {
        if (v?.vaultRef) removeVault({ vaultRef: v.vaultRef });
      });

      this.documents = (this.documents || []).filter(d => d.id !== id);
      this.relations = (this.relations || []).filter(r => {
        return !(
          (r.source?.kind === "doc" && r.source?.id === id) ||
          (r.target?.kind === "doc" && r.target?.id === id)
        );
      });
      this.addDocAuditLog({
        action: "purge",
        actor: meta.actor || "-",
        docId: id,
        detail: `彻底删除：${doc.name}`
      });
      return true;
    },
    addModelFromUpload(file, meta = {}) {
      const filename = file?.name || "未命名模型";
      const base = filename.includes(".")
        ? filename.slice(0, filename.lastIndexOf("."))
        : filename;
      const name = base || "未命名模型";

      let url = "";
      try {
        if (typeof window !== "undefined" && window.URL?.createObjectURL) {
          url = window.URL.createObjectURL(file);
        }
      } catch {
        url = "";
      }

      const item = {
        id: `m-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        icon: "🏢",
        name,
        url,
        lod: "LOD300",
        components: 300,
        updatedAt: todayText(),
        nodeIds: meta.nodeIds || [],
        kksRefs: meta.kksRefs || []
      };
      this.models.unshift(item);
      return item;
    },
    updateModel(id, patch) {
      const idx = this.models.findIndex(m => m.id === id);
      if (idx < 0) return;
      Object.assign(this.models[idx], patch, { updatedAt: todayText() });
    },
    importDataFiles(files) {
      if (!files?.length) return { version: null, newItems: [] };

      this.dataVersions.unshift({
        id: `v-${Date.now()}`,
        name: files[0]?.name || "数据文件",
        time: nowText(),
        note: `导入 ${files.length} 个文件（原型演示）`
      });

      const newItems = files.slice(0, 3).map((f, idx) => {
        const base = (f?.name || `导入文件-${idx + 1}`).replace(
          /\.[^/.]+$/,
          ""
        );
        return {
          kks: `IMP-${String(Date.now()).slice(-6)}-${idx + 1}`,
          name: base,
          type: "设备",
          status: "待校验",
          nodeId: ""
        };
      });

      this.kksItems.unshift(...newItems);
      return { version: this.dataVersions[0], newItems };
    },
    validateAllKks() {
      let updated = 0;
      this.kksItems.forEach(r => {
        if (r.status !== "已校验") {
          if (!r.kks || !r.name) r.status = "异常";
          else r.status = "已校验";
          updated++;
        }
      });
      return updated;
    },
    relationDisplayName(ref) {
      if (!ref) return "-";
      if (ref.kind === "node") return this.getNodeLabel(ref.id);
      if (ref.kind === "kks") return this.getKksLabel(ref.id);
      if (ref.kind === "doc") return this.getDocById(ref.id)?.name || ref.id;
      if (ref.kind === "model")
        return this.getModelById(ref.id)?.name || ref.id;
      return `${ref.kind}:${ref.id}`;
    },
    addRelation(payload) {
      const item = {
        id: `r${Math.random().toString(16).slice(2, 8)}`,
        type: payload.type,
        source: payload.source,
        target: payload.target,
        updatedAt: nowText()
      };
      this.relations.unshift(item);
      return item;
    },
    updateRelation(id, patch) {
      const idx = this.relations.findIndex(r => r.id === id);
      if (idx < 0) return;
      this.relations[idx] = {
        ...this.relations[idx],
        ...patch,
        updatedAt: nowText()
      };
    },
    deleteRelation(id) {
      this.relations = this.relations.filter(r => r.id !== id);
    },
    search(query, scopeKeys) {
      const kw = (query || "").trim().toLowerCase();
      const scopes =
        Array.isArray(scopeKeys) && scopeKeys.length ? scopeKeys : [];
      const inScopes = key => (scopes.length ? scopes.includes(key) : true);

      const out = [];

      if (inScopes("documents")) {
        this.documents.forEach(d => {
          const kks = d.kksRefs?.[0] || "";
          const hay = `${d.name} ${kks} ${d.type}`.toLowerCase();
          if (!kw || hay.includes(kw)) {
            out.push({
              id: d.id,
              kind: "doc",
              scope: "documents",
              title: d.name,
              type: "文档",
              kks,
              description: d.nodeIds?.length
                ? `关联系统：${d.nodeIds.map(this.getNodeLabel).join("，")}`
                : "文档条目（演示）"
            });
          }
        });
      }

      if (inScopes("models")) {
        this.models.forEach(m => {
          const kks = m.kksRefs?.[0] || "";
          const hay = `${m.name} ${kks} ${m.lod}`.toLowerCase();
          if (!kw || hay.includes(kw)) {
            out.push({
              id: m.id,
              kind: "model",
              scope: "models",
              title: m.name,
              type: "三维模型",
              kks,
              description: m.nodeIds?.length
                ? `关联系统：${m.nodeIds.map(this.getNodeLabel).join("，")}`
                : "模型条目（演示）"
            });
          }
        });
      }

      if (inScopes("devices")) {
        this.kksItems.forEach(k => {
          const hay = `${k.kks} ${k.name} ${k.type}`.toLowerCase();
          if (!kw || hay.includes(kw)) {
            out.push({
              id: k.kks,
              kind: "kks",
              scope: "devices",
              title: `${k.name}（${k.kks}）`,
              type: "设备/台账",
              kks: k.kks,
              description: k.nodeId
                ? `所属系统：${this.getNodeLabel(k.nodeId)}`
                : "台账条目（演示）"
            });
          }
        });
      }

      return out;
    }
  }
});

export function useDdLinkageStoreHook() {
  return useDdLinkageStore(store);
}
