// 模拟后端动态生成路由
import { defineFakeRoute } from "vite-plugin-fake-server/client";

/**
 * roles：页面级别权限，这里模拟二种 "admin"、"common"
 * admin：管理员角色
 * common：普通角色
 */
const permissionRouter = {
  path: "/permission",
  meta: {
    title: "权限管理",
    icon: "ep:lollipop",
    rank: 10
  },
  children: [
    {
      path: "/permission/page/index",
      name: "PermissionPage",
      meta: {
        title: "页面权限"
      }
    },
    {
      path: "/permission/button",
      meta: {
        title: "按钮权限"
      },
      children: [
        {
          path: "/permission/button/router",
          component: "permission/button/index",
          name: "PermissionButtonRouter",
          meta: {
            title: "路由返回按钮权限",
            auths: [
              "permission:btn:add",
              "permission:btn:edit",
              "permission:btn:delete"
            ]
          }
        },
        {
          path: "/permission/button/login",
          component: "permission/button/perms",
          name: "PermissionButtonLogin",
          meta: {
            title: "登录接口返回按钮权限"
          }
        }
      ]
    }
  ]
};

/** 原型：数据移交 */
const handoverRouter = {
  path: "/handover",
  name: "Handover",
  component: "handover/index",
  meta: {
    title: "数据移交",
    icon: "ep:folder-opened",
    rank: 1
  },
  children: [
    {
      path: "/handover/dashboard",
      name: "HandoverDashboard",
      component: "handover/dashboard/index",
      meta: {
        title: "仪表板",
        icon: "ep:data-analysis"
      }
    },
    {
      path: "/handover/documents",
      name: "HandoverDocuments",
      component: "handover/documents/index",
      meta: {
        title: "文档管理",
        icon: "ep:document"
      }
    },
    {
      path: "/handover/models",
      name: "HandoverModels",
      component: "handover/models/index",
      meta: {
        title: "模型管理",
        icon: "ep:office-building"
      }
    },
    {
      path: "/handover/data",
      name: "HandoverData",
      component: "handover/data/index",
      meta: {
        title: "数据管理",
        icon: "ep:histogram"
      }
    },
    {
      path: "/handover/projects",
      name: "HandoverProjects",
      component: "handover/projects/index",
      meta: {
        title: "项目管理",
        icon: "ep:folder"
      }
    }
  ]
};

/** 原型：搜索导航 */
const searchNavRouter = {
  path: "/search-nav",
  name: "SearchNav",
  component: "searchNav/index",
  meta: {
    title: "搜索导航",
    icon: "ep:search",
    rank: 2
  },
  children: [
    {
      path: "/search-nav/search",
      name: "SmartSearch",
      component: "searchNav/search/index",
      meta: {
        title: "智能搜索",
        icon: "ep:search"
      }
    },
    {
      path: "/search-nav/navigation",
      name: "SystemNavigation",
      component: "searchNav/navigation/index",
      meta: {
        title: "系统导航",
        icon: "ep:guide"
      }
    },
    {
      path: "/search-nav/relationships",
      name: "Relationships",
      component: "searchNav/relationships/index",
      meta: {
        title: "关联关系",
        icon: "ep:share"
      }
    }
  ]
};

/** 原型：三维可视化 */
const visualizationRouter = {
  path: "/visualization",
  name: "Visualization",
  component: "visualization/index",
  meta: {
    title: "三维可视化",
    icon: "ep:view",
    rank: 3
  },
  children: [
    {
      path: "/visualization/3d-viewer",
      name: "Viewer3D",
      component: "visualization/viewer3d/index",
      meta: {
        title: "三维查看",
        icon: "ep:view"
      }
    },
    {
      path: "/visualization/3d-fullscreen",
      name: "Viewer3DFullscreen",
      component: "visualization/viewer3d/fullscreen",
      meta: {
        title: "三维全屏",
        showLink: false
      }
    },
    {
      path: "/visualization/monitor",
      name: "VisualizationMonitor",
      component: "visualization/monitor/index",
      meta: {
        title: "可视化监控",
        icon: "ep:monitor"
      }
    },
    {
      path: "/visualization/video",
      name: "VideoLinkage",
      component: "visualization/video/index",
      meta: {
        title: "视频联动",
        icon: "ep:video-camera"
      }
    }
  ]
};

/** 原型：系统管理 */
const systemRouter = {
  path: "/system",
  name: "System",
  component: "system/index",
  meta: {
    title: "系统管理",
    icon: "ep:setting",
    rank: 4
  },
  children: [
    {
      path: "/system/users",
      name: "SystemUsers",
      component: "system/users/index",
      meta: {
        title: "用户权限",
        icon: "ep:user"
      }
    },
    {
      path: "/system/audit",
      name: "SystemAudit",
      component: "system/audit/index",
      meta: {
        title: "日志审计",
        icon: "ep:document-checked"
      }
    },
    {
      path: "/system/settings",
      name: "SystemSettings",
      component: "system/settings/index",
      meta: {
        title: "系统配置",
        icon: "ep:tools"
      }
    }
  ]
};

export default defineFakeRoute([
  {
    url: "/get-async-routes",
    method: "get",
    response: () => {
      return {
        success: true,
        data: [
          handoverRouter,
          searchNavRouter,
          visualizationRouter,
          systemRouter
          // permissionRouter
        ]
      };
    }
  }
]);
