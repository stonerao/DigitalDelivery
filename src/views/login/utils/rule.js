import { reactive } from "vue";

/** 密码正则（密码长度至少 5 位） */
export const REGEXP_PWD = /^.{5,}$/;

/** 登录校验 */
const loginRules = reactive({
  password: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error("请输入密码"));
        } else if (!REGEXP_PWD.test(value)) {
          callback(new Error("密码长度不能少于5位"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

export { loginRules };
