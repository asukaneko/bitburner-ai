# 第三方来源与许可

## Bitburner 3.0.1

- 来源：https://github.com/bitburner-official/bitburner-src/tree/v3.0.1
- 本仓库安装包中的 `resources/app/main.js`、`preload.js`、`index.html` 基于游戏文件修改，分别加入 AI 助手注册、IPC 桥和界面资源加载。
- `tests/fixtures/` 从该版本的脚本执行模块和终端输入处理代码提取，用于验证正常 RAM 检查和键盘事件行为；终端夹具移除了 TypeScript 类型标注。
- 保留游戏该版本的 Apache 2.0 with Commons Clause 许可原文：[bitburner-license.txt](package/Bitburner-AI-Patch/third-party-licenses/bitburner-license.txt)。

## Bitburner 简体中文补丁

- 作者与来源：[s567901/bitburner-zh-CN](https://github.com/s567901/bitburner-zh-CN)，版本 `407d8c70df858c51f73008caa38becfca201902f`。
- 安装包的游戏包装文件基于已应用该汉化的文件继续修改。
- 提供方的许可说明原文：[bitburner-zh-CN-LICENSE.txt](package/Bitburner-AI-Patch/third-party-licenses/bitburner-zh-CN-LICENSE.txt)。游戏自身代码采用上面附带的官方版本许可。

## Markdown 组件

- [Marked](https://github.com/markedjs/marked) 18.1.1：MIT，见 [许可](package/Bitburner-AI-Patch/third-party-licenses/marked-LICENSE.txt)。
- [DOMPurify](https://github.com/cure53/DOMPurify) 3.4.17：MPL-2.0 OR Apache-2.0，见 [许可](package/Bitburner-AI-Patch/third-party-licenses/dompurify-LICENSE.txt)。

上述许可适用于相应第三方内容，不代表对本仓库自有代码指定了相同许可。
