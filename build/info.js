/*
 * @Date: 2026-01-15 16:15:30
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-04-15 10:05:24
 * @FilePath: \DigitalDelivery\build\info.js
 */
import boxen from "boxen";
import gradient from "gradient-string";
import { getPackageSize } from "./utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

const welcomeMessage = gradient(["cyan", "magenta"]).multiline(``);

const boxenOptions = {
  padding: 0.5,
  borderColor: "cyan",
  borderStyle: "round"
};

export function viteBuildInfo() {
  let config;
  let startTime;
  let endTime;
  let outDir;
  return {
    name: "vite:buildInfo",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      outDir = resolvedConfig.build?.outDir ?? "dist";
    },
    buildStart() {
      console.log(boxen(welcomeMessage, boxenOptions));
      if (config.command === "build") {
        startTime = dayjs(new Date());
      }
    },
    closeBundle() {
      if (config.command === "build") {
        endTime = dayjs(new Date());
        getPackageSize({
          folder: outDir,
          callback: size => {
            console.log(
              boxen(
                gradient(["cyan", "magenta"]).multiline(
                  `🎉 恭喜打包完成（总用时${dayjs
                    .duration(endTime.diff(startTime))
                    .format("mm分ss秒")}，打包后的大小为${size}）`
                ),
                boxenOptions
              )
            );
          }
        });
      }
    }
  };
}
