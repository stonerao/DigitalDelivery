import { http } from "@/utils/http";

/** 获取 RSA 公钥（用于加密登录密码） */
export const getPublicKey = () => {
  return http.request("get", "/api/auth/publicKey");
};

/** 用户登录（RSA 加密密码） */
export const getLogin = data => {
  return http.request("post", "/api/auth/login", { data });
};

/** 刷新`token` */
export const refreshTokenApi = data => {
  return http.request("post", "/refresh-token", { data });
};
