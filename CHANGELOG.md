# 更新日志

本插件遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## 2.0.0

- **按官方要求引入 `Config`**：提示音开关、默认音色、是否包含子代理、最小间隔、总音量五项全部成为受 schema 校验的配置字段，默认值写在 schema 上，不再硬编码在浏览器半边。
- **偏好改为写入 profile 设置文档**：浏览器半边通过设置镜像 `ctx.configForms` 读写配置，用户的音色选择因此落到 `cordis.patch.yml`，不再依赖浏览器存储；旧 `localStorage` 值保留为回退与镜像。
- 设置行改为官方推荐写法：注册包在 `ctx.configForms.whileServed([NS], …)` 内，配置通过插槽的 `hooks` 位（store 对象）传入，写入走 `configForm.set('preset', …)`。
- 新增运行时依赖 `@deepseek-ai/schemastery`，精确锁定 `3.18.4`（与当前安装附带版本一致）。
- 包名由本地占位 `@local/dsh-task-complete-sound` 改为公开发布名 `dsh-task-complete-sound`：`package.json`、`cordis.patch.yml`、客户端 bundle id 三处同步；补齐 `author` / `repository` / `homepage` / `bugs`；`LICENSE` 填入著作权人。
- 签名格式扩展为 `<会话id>|<0|1>|<n|s>`：`includeSubagents` 的切换不再可能被误判为一次任务完成。

## 1.6.0

- 移除 `pluck`（拨弦）。
- 新增 `deep`（厚重）：低八度 G3 打底，叠加三角波增加谐波密度，再补五度与八度。
- 合成器新增第 7 个音调参数 `attackMs`（起音时间），`deep` 用它做 22–34 ms 的慢起音，把"咔哒"换成"份量"。

## 1.5.0

- 移除 `bell`（铃音）、`success`（上行）、`pulse`（脉冲）。
- 新增 `wood`（木鱼）、`soft`（柔和）、`pluck`（拨弦，1.6.0 已移除）。
- 合成器新增第 6 个音调参数：终止频率，支持音高滑音。

## 1.4.0

- **修复设置行不显示**：插槽注册的 `hooks` 位只接受 store 对象（框架会自行调用它的 `getSnapshot()`），此前传入 hook 函数导致该行每次渲染都抛 `TypeError: … getSnapshot is not a function` 而被清空。现改为通过普通 prop 传入 hook。
- **修复监视器漏报**：把"上一次状态"基线从组件内的 `useRef` 改为模块作用域，避免客户端条目被销毁重建时丢掉正在运行的状态。
- 整体提高音量约 8 dB，并略微加长默认音。

## 1.2.0

- 新增 `settings.general.item` 设置行：五种音色可选，点击即试听。
- 新增解锁提示：浏览器在页面首次交互前会拦截音频，此时左下角给出一次性提示。
- 新增第二条会话级监视器，并共用节流以保证只响一次。

## 1.0.0

- 首个可用版本：`shell.overlay` 全窗口监视器，任务结束时播放合成提示音。
