import Cookies from "js-cookie";
import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal, isString, isIncludeAllChildren } from "@pureadmin/utils";

export const userKey = "user-info";
export const TokenKey = "authorized-token";
const DEFAULT_ALL_ROLES = ["admin", "common"];
const DEFAULT_ALL_PERMISSIONS = ["*:*:*"];
/**
 * 通过`multiple-tabs`是否在`cookie`中，判断用户是否已经登录系统，
 * 从而支持多标签页打开已经登录的系统后无需再登录。
 * 浏览器完全关闭后`multiple-tabs`将自动从`cookie`中销毁，
 * 再次打开浏览器需要重新登录系统
 * */
export const multipleTabsKey = "multiple-tabs";

function normalizeTokenData(payload = {}) {
  const accessToken = payload?.accessToken || payload?.token || "";
  const refreshToken = payload?.refreshToken || "";
  let expires = Number(payload?.expires);
  if (!Number.isFinite(expires) || expires <= 0) {
    // 后端未返回过期时间时，给一个默认有效期，避免请求拦截器误判过期
    expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
  return {
    ...payload,
    accessToken,
    refreshToken,
    expires
  };
}

/** 获取`token` */
export function getToken() {
  // 此处与`TokenKey`相同，此写法解决初始化时`Cookies`中不存在`TokenKey`报错
  const raw = Cookies.get(TokenKey)
    ? JSON.parse(Cookies.get(TokenKey))
    : storageLocal().getItem(userKey);
  return normalizeTokenData(raw || {});
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`，`refreshToken`的过期时间（比如30天）应大于`accessToken`的过期时间（比如2小时））、`expires`（`accessToken`的过期时间）
 * 将`accessToken`、`expires`、`refreshToken`这三条信息放在key值为authorized-token的cookie里（过期自动销毁）
 * 将`avatar`、`username`、`nickname`、`roles`、`permissions`、`refreshToken`、`expires`这七条信息放在key值为`user-info`的localStorage里（利用`multipleTabsKey`当浏览器完全关闭后自动销毁）
 */
export function setToken(data) {
  const normalized = normalizeTokenData(data);
  const { accessToken, refreshToken, expires } = normalized;
  const { isRemembered, loginDay } = useUserStoreHook();

  if (!accessToken) return;

  const cookieString = JSON.stringify({ accessToken, expires, refreshToken });

  expires > 0
    ? Cookies.set(TokenKey, cookieString, {
        expires: (expires - Date.now()) / 86400000
      })
    : Cookies.set(TokenKey, cookieString);

  Cookies.set(
    multipleTabsKey,
    "true",
    isRemembered
      ? {
          expires: loginDay
        }
      : {}
  );

  function setUserKey({ avatar, username, nickname, roles, permissions }) {
    useUserStoreHook().SET_AVATAR(avatar);
    useUserStoreHook().SET_USERNAME(username);
    useUserStoreHook().SET_NICKNAME(nickname);
    useUserStoreHook().SET_ROLES(roles);
    useUserStoreHook().SET_PERMS(permissions);
    storageLocal().setItem(userKey, {
      accessToken,
      refreshToken,
      expires,
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }

  if (normalized.username) {
    const username = normalized.username;
    const roles =
      Array.isArray(normalized.roles) && normalized.roles.length > 0
        ? normalized.roles
        : DEFAULT_ALL_ROLES;
    setUserKey({
      avatar: normalized?.avatar ?? "",
      username,
      nickname: normalized?.nickname ?? "",
      roles,
      permissions:
        Array.isArray(normalized?.permissions) &&
        normalized.permissions.length > 0
          ? normalized.permissions
          : DEFAULT_ALL_PERMISSIONS
    });
  } else {
    const avatar = storageLocal().getItem(userKey)?.avatar ?? "";
    const username = storageLocal().getItem(userKey)?.username ?? "";
    const nickname = storageLocal().getItem(userKey)?.nickname ?? "";
    const roles = storageLocal().getItem(userKey)?.roles ?? [];
    const permissions = storageLocal().getItem(userKey)?.permissions ?? [];
    setUserKey({
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }
}

/** 删除`token`以及key值为`user-info`的localStorage信息 */
export function removeToken() {
  Cookies.remove(TokenKey);
  Cookies.remove(multipleTabsKey);
  storageLocal().removeItem(userKey);
}

/** 格式化token（jwt格式） */
export const formatToken = token => {
  return "Bearer " + token;
};

/** 是否有按钮级别的权限（根据登录接口返回的`permissions`字段进行判断）*/
export const hasPerms = value => {
  if (!value) return false;
  const allPerms = "*:*:*";
  const { permissions } = useUserStoreHook();
  if (!permissions) return false;
  if (permissions.length === 1 && permissions[0] === allPerms) return true;
  const isAuths = isString(value)
    ? permissions.includes(value)
    : isIncludeAllChildren(value, permissions);
  return isAuths ? true : false;
};
