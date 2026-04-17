import { defineStore } from "pinia";
import {
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import { getLogin, getPublicKey, refreshTokenApi } from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import { setToken, removeToken, userKey } from "@/utils/auth";

export const useUserStore = defineStore("pure-user", {
  state: () => ({
    // 头像
    avatar: storageLocal().getItem(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem(userKey)?.nickname ?? "",
    // 页面级别权限
    roles: storageLocal().getItem(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions: storageLocal().getItem(userKey)?.permissions ?? [],
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    isApiSuccess(res) {
      return res?.success === true || res?.code === 200 || res?.code === 0;
    },
    /** 存储头像 */
    SET_AVATAR(avatar) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname) {
      this.nickname = nickname;
    },
    /** 存储角色 */
    SET_ROLES(roles) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions) {
      this.permissions = permissions;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value) {
      this.loginDay = Number(value);
    },
    /** 登入（先获取 RSA 公钥加密密码，再提交登录） */
    async loginByUsername(data) {
      return new Promise(async (resolve, reject) => {
        try {
          // 1. 获取 RSA 公钥
          const keyRes = await getPublicKey();
          if (!this.isApiSuccess(keyRes)) {
            reject(new Error(keyRes?.message || "获取公钥失败"));
            return;
          }
          const { publicKey, keyId } = keyRes.data ?? {};

          // 2. RSA 加密密码
          const { JSEncrypt } = await import("jsencrypt");
          const encryptor = new JSEncrypt();
          encryptor.setPublicKey(publicKey);
          const encryptedPassword = encryptor.encrypt(data.password);
          if (!encryptedPassword) {
            reject(new Error("密码加密失败，请刷新页面重试"));
            return;
          }

          // 3. 提交登录
          const loginRes = await getLogin({
            username: data.username,
            encryptedPassword,
            keyId
          });

          // 4. 适配后端返回格式 { code, message, data } → { success, data, message }
          const success = this.isApiSuccess(loginRes);
          const result = {
            success,
            message: loginRes?.message || "",
            data: loginRes?.data || {}
          };

          if (success) setToken(result.data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    },
    /** 前端登出（不调用接口） */
    logOut() {
      this.username = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
    },
    /** 刷新`token` */
    async handRefreshToken(data) {
      return new Promise((resolve, reject) => {
        refreshTokenApi(data)
          .then(res => {
            if (res) {
              // 兼容 { success, data } 与 { code, data } 两种后端风格
              const tokenData = res?.data ?? res;
              setToken(tokenData);
              resolve(res);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
