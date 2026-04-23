import { h, defineComponent } from "vue";

/** 登录页轻量入场动画包裹组件 */
export default defineComponent({
  name: "Motion",
  props: {
    delay: {
      type: Number,
      default: 50
    }
  },
  render() {
    return h(
      "div",
      {
        class: "login-motion",
        style: {
          animationDelay: `${this.delay}ms`
        }
      },
      {
        default: () => [this.$slots.default?.()]
      }
    );
  }
});
