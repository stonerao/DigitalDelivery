import { h, defineComponent } from "vue";

/** 封装@vueuse/motion动画库中的自定义指令v-motion */
export default defineComponent({
  name: "Motion",
  props: {
    delay: {
      type: Number,
      default: 50
    }
  },
  render() {
    // 传统中文风格：不使用入场动效，仅作为布局包裹组件
    return h(
      "div",
      {},
      {
        default: () => [this.$slots.default?.()]
      }
    );
  }
});
