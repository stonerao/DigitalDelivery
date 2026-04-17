export const getAsyncRoutes = () => {
  // 路由改为内置，保留兼容方法供旧代码调用
  return Promise.resolve({ data: [] });
};
