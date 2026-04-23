<script setup>
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { ref, toRaw, reactive } from "vue";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useEventListener } from "@vueuse/core";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { illustration } from "./utils/static";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import Lock from "~icons/ri/lock-fill";
import User from "~icons/ri/user-3-fill";

defineOptions({
  name: "Login"
});

const router = useRouter();
const loading = ref(false);
const disabled = ref(false);
const ruleFormRef = ref();

const { initStorage } = useLayout();
initStorage();

const { dataTheme, themeMode, dataThemeChange } = useDataThemeChange();
dataThemeChange(themeMode.value);
const { title, getLogo } = useNav();

const ruleForm = reactive({
  username: "admin",
  password: "123456"
});

const onLogin = async formEl => {
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      loading.value = true;
      disabled.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: ruleForm.password
        })
        .then(async res => {
          if (res.success) {
            // 获取后端路由
            await initRouter();
            const topMenu = getTopMenu(true);
            const targetPath = topMenu?.path || "/handover/dashboard";
            await router.push(targetPath);
            message("登录成功", { type: "success" });
          } else {
            message(res?.message || "登录失败", { type: "error" });
          }
        })
        .catch(error => {
          message(error?.message || "登录失败", { type: "error" });
        })
        .finally(() => {
          loading.value = false;
          disabled.value = false;
        });
    }
  });
};

const immediateDebounce = debounce(formRef => onLogin(formRef), 1000, true);

useEventListener(document, "keydown", ({ code }) => {
  if (
    ["Enter", "NumpadEnter"].includes(code) &&
    !disabled.value &&
    !loading.value
  )
    immediateDebounce(ruleFormRef.value);
});
</script>

<template>
  <div class="login-page select-none">
    <div class="login-backdrop" aria-hidden="true">
      <span class="login-orb login-orb-primary" />
      <span class="login-orb login-orb-secondary" />
      <span class="login-grid" />
    </div>
    <div class="login-theme flex-c">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
    </div>
    <div class="login-container">
      <section class="login-hero">
        <Motion>
          <div class="brand-lockup">
            <img :src="getLogo()" class="brand-logo" alt="数字化移交平台logo" />
            <div class="brand-copy">
              <span class="brand-eyebrow">Digital Handover</span>
              <h1>{{ title }}</h1>
            </div>
          </div>
        </Motion>

        <Motion :delay="120">
          <p class="hero-kicker">工程资料 · 三维模型 · 移交成果</p>
        </Motion>

        <Motion :delay="180">
          <h2 class="hero-title">让移交数据从现场到运营保持一致</h2>
        </Motion>

        <Motion :delay="240">
          <p class="hero-desc">
            统一管理图纸、模型、文档与设备对象，建立可追溯、可复用、可交付的数据底座。
          </p>
        </Motion>

        <Motion :delay="300">
          <div class="hero-support">
            <span>模型关联</span>
            <span>资料归档</span>
            <span>过程追溯</span>
          </div>
        </Motion>

        <div class="visual-stage" aria-hidden="true">
          <component :is="toRaw(illustration)" class="login-illustration" />
          <span class="visual-ring" />
          <span class="visual-line visual-line-a" />
          <span class="visual-line visual-line-b" />
        </div>
      </section>

      <div class="login-box">
        <div class="login-form">
          <Motion>
            <div class="form-header">
              <img
                :src="getLogo()"
                class="form-logo"
                alt="数字化移交平台logo"
              />
              <span class="form-eyebrow">Account Access</span>
              <h2 class="outline-hidden">欢迎登录</h2>
              <p>使用平台账号进入数字化移交工作台</p>
            </div>
          </Motion>

          <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
          >
            <Motion :delay="100">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: '请输入账号',
                    trigger: 'blur'
                  }
                ]"
                prop="username"
              >
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder="账号"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  placeholder="密码"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="250">
              <el-button
                class="login-submit w-full mt-4!"
                size="default"
                type="primary"
                :loading="loading"
                :disabled="disabled"
                @click="onLogin(ruleFormRef)"
              >
                登录
              </el-button>
            </Motion>
          </el-form>
        </div>
      </div>
    </div>
    <div class="login-footer">数字化移交平台 · 安全访问</div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

:deep(.login-form .el-form-item) {
  margin-bottom: 20px;
}

:deep(.login-form .el-input__wrapper) {
  min-height: 46px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(15, 34, 56, 0.08);
  border-radius: 14px;
  box-shadow: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

:deep(.login-form .el-input__wrapper:hover),
:deep(.login-form .el-input__wrapper.is-focus) {
  background: #ffffff;
  border-color: rgba(24, 213, 194, 0.5);
  box-shadow: 0 0 0 4px rgba(24, 213, 194, 0.12);
}

:deep(.login-form .el-input__inner) {
  color: #0f2238;
  font-weight: 500;
}

:deep(.login-form .el-input__prefix) {
  color: #18d5c2;
}
</style>
