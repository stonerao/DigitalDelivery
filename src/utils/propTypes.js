import { createTypes, toValidableType } from "vue-types";

const newPropTypes = createTypes({
  func: undefined,
  bool: undefined,
  string: undefined,
  number: undefined,
  object: undefined,
  integer: undefined
});

// 从 vue-types v5.0 开始，extend()方法已经废弃，当前已改为官方推荐的ES6+方法 https://dwightjack.github.io/vue-types/advanced/extending-vue-types.html#the-extend-method
export default class propTypes extends newPropTypes {
  // a native-like validator that supports the `.validable` method
  static get style() {
    return toValidableType("style", {
      type: [String, Object]
    });
  }

  static get VNodeChild() {
    return toValidableType("VNodeChild", {
      type: undefined
    });
  }
}
