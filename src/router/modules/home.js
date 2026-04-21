const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/",
    name: "Home",
    component: Layout,
    redirect: "/handover/dashboard",
    meta: {
      icon: "ep/home-filled",
      title: "首页",
      rank: 0,
      showLink: false
    },
    children: [
      {
        path: "/welcome",
        name: "Welcome",
        component: () => import("@/views/welcome/index.vue"),
        meta: {
          title: "首页",
          showLink: false
        }
      }
    ]
  },
  {
    path: "/error",
    redirect: "/error/403",
    component: Layout,
    meta: {
      icon: "ri/information-line",
      title: "异常页面",
      rank: 9,
      showLink: false
    },
    children: [
      {
        path: "/error/403",
        name: "403",
        component: () => import("@/views/error/403.vue"),
        meta: {
          title: "403",
          showLink: false
        }
      },
      {
        path: "/error/404",
        name: "404",
        component: () => import("@/views/error/404.vue"),
        meta: {
          title: "404",
          showLink: false
        }
      },
      {
        path: "/error/500",
        name: "500",
        component: () => import("@/views/error/500.vue"),
        meta: {
          title: "500",
          showLink: false
        }
      }
    ]
  },
  {
    path: "/handover",
    name: "Handover",
    component: () => import("@/views/handover/index.vue"),
    redirect: "/handover/dashboard",
    meta: {
      title: "数据移交",
      icon: "ep:folder-opened",
      rank: 1
    },
    children: [
      {
        path: "/handover/dashboard",
        name: "HandoverDashboard",
        component: () => import("@/views/handover/dashboard/index.vue"),
        meta: {
          title: "仪表板",
          icon: "ep:data-analysis"
        }
      },
      {
        path: "/handover/documents",
        name: "HandoverDocuments",
        component: () => import("@/views/handover/documents/index.vue"),
        meta: {
          title: "文档管理",
          icon: "ep:document"
        }
      },
      {
        path: "/handover/models",
        name: "HandoverModels",
        component: () => import("@/views/handover/models/index.vue"),
        meta: {
          title: "模型管理",
          icon: "ep:office-building"
        }
      },
      {
        path: "/handover/data",
        name: "HandoverData",
        component: () => import("@/views/handover/data/index.vue"),
        meta: {
          title: "数据管理",
          icon: "ep:histogram"
        }
      },
      {
        path: "/handover/projects",
        name: "HandoverProjects",
        component: () => import("@/views/handover/projects/index.vue"),
        meta: {
          title: "项目管理",
          icon: "ep:folder"
        }
      },
      {
        path: "/handover/dwg-preview-poc",
        name: "HandoverDwgPreviewPoc",
        component: () => import("@/views/handover/documents/dwgPreviewPoc.vue"),
        meta: {
          title: "DWG 预览 PoC",
          showLink: false
        }
      }
    ]
  },
  {
    path: "/search-nav",
    name: "SearchNav",
    component: () => import("@/views/searchNav/index.vue"),
    redirect: "/search-nav/search",
    meta: {
      title: "搜索导航",
      icon: "ep:search",
      rank: 2
    },
    children: [
      {
        path: "/search-nav/search",
        name: "SmartSearch",
        component: () => import("@/views/searchNav/search/index.vue"),
        meta: {
          title: "智能搜索",
          icon: "ep:search"
        }
      },
      {
        path: "/search-nav/navigation",
        name: "SystemNavigation",
        component: () => import("@/views/searchNav/navigation/index.vue"),
        meta: {
          title: "系统导航",
          icon: "ep:guide"
        }
      },
      {
        path: "/search-nav/relationships",
        name: "Relationships",
        component: () => import("@/views/searchNav/relationships/index.vue"),
        meta: {
          title: "关联关系",
          icon: "ep:share"
        }
      }
    ]
  },
  {
    path: "/visualization",
    name: "Visualization",
    component: () => import("@/views/visualization/index.vue"),
    redirect: "/visualization/3d-viewer",
    meta: {
      title: "三维可视化",
      icon: "ep:view",
      rank: 3
    },
    children: [
      {
        path: "/visualization/3d-viewer",
        name: "Viewer3D",
        component: () => import("@/views/visualization/viewer3d/index.vue"),
        meta: {
          title: "三维查看",
          icon: "ep:view"
        }
      },
      {
        path: "/visualization/3d-fullscreen",
        name: "Viewer3DFullscreen",
        component: () =>
          import("@/views/visualization/viewer3d/fullscreen.vue"),
        meta: {
          title: "三维全屏",
          showLink: false
        }
      },
      {
        path: "/visualization/monitor",
        name: "VisualizationMonitor",
        component: () => import("@/views/visualization/monitor/index.vue"),
        meta: {
          title: "可视化监控",
          icon: "ep:monitor"
        }
      },
      {
        path: "/visualization/video",
        name: "VideoLinkage",
        component: () => import("@/views/visualization/video/index.vue"),
        meta: {
          title: "视频联动",
          icon: "ep:video-camera"
        }
      }
    ]
  },
  {
    path: "/system",
    name: "System",
    component: () => import("@/views/system/index.vue"),
    redirect: "/system/users",
    meta: {
      title: "系统管理",
      icon: "ep:setting",
      rank: 4
    },
    children: [
      {
        path: "/system/users",
        name: "SystemUsers",
        component: () => import("@/views/system/users/index.vue"),
        meta: {
          title: "用户权限",
          icon: "ep:user"
        }
      },
      {
        path: "/system/roles",
        name: "SystemRoles",
        component: () => import("@/views/system/roles/index.vue"),
        meta: {
          title: "角色管理",
          icon: "ep:avatar"
        }
      },
      {
        path: "/system/audit",
        name: "SystemAudit",
        component: () => import("@/views/system/audit/index.vue"),
        meta: {
          title: "日志审计",
          icon: "ep:document-checked"
        }
      }/* ,
      {
        path: "/system/settings",
        name: "SystemSettings",
        component: () => import("@/views/system/settings/index.vue"),
        meta: {
          title: "系统配置",
          icon: "ep:tools"
        }
      } */
    ]
  }
  /* {
    path: "/permission",
    name: "Permission",
    component: Layout,
    redirect: "/permission/page/index",
    meta: {
      title: "权限管理",
      icon: "ep:lollipop",
      rank: 10
    },
    children: [
      {
        path: "/permission/page/index",
        name: "PermissionPage",
        component: () => import("@/views/permission/page/index.vue"),
        meta: {
          title: "页面权限"
        }
      },
      {
        path: "/permission/button/router",
        name: "PermissionButtonRouter",
        component: () => import("@/views/permission/button/index.vue"),
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
        name: "PermissionButtonLogin",
        component: () => import("@/views/permission/button/perms.vue"),
        meta: {
          title: "登录接口返回按钮权限"
        }
      }
    ]
  } */
];
