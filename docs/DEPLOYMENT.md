# 部署状态与复现

## 当前状态

**v1.1已于2026-10-01上线：** https://xuelixunhua.github.io/cta-strategy-lab/ 。提交 `d861eab2d42bf0b2e3d2eec0ee4577858a2e4f9f` 加入指定数据包；[部署运行36833240635](https://github.com/xuelixunhua/cta-strategy-lab/actions/runs/36833240635) 与 [验证运行36833240636](https://github.com/xuelixunhua/cta-strategy-lab/actions/runs/36833240636) 均成功。

本次核查时Pages已配置为GitHub Actions，最近的失败发生在“Check data input”：仓库缺少指定ZIP。加入与脚本固定SHA256一致的原包后，36项单元测试、89组行情的1602次全历史检查、案例生成和Pages部署均通过。此前的首次启用权限拒绝及临时下载链接403是旧部署记录，不是本次失败原因。

线上Chromium验收覆盖首页、8种策略、4种独立保护退出、BTC小时线、AAPL日线及不可用小时按钮、逐笔定位、缩放/平移、CSV/JSON导出与390px窄屏。验收访问无脚本错误或HTTP失败；K线由Canvas绘制，ZIP包含18份OHLC行情JSON及1份来源清单，并非图片素材。

旧的临时链接导入工作流已移除。最终流程不保存或使用私有GitHub访问令牌，也不让网页访问私有仓库。

## 新仓库首次发布（当前仓库已完成）

先打开 https://github.com/xuelixunhua/cta-strategy-lab/settings/pages ，把 Build and deployment 的 Source 设为 **GitHub Actions**。

再将提供的 **cta-public-ohlc-export.zip** 上传到仓库根目录，保留这个文件名，不解压，不上传整份私有研究仓库。网页上传入口：https://github.com/xuelixunhua/cta-strategy-lab/upload/main 。文件为7,357,473字节，SHA256为 `0a28aa2d13d92184de69375bfdde65df1d3de71b1cb5c212d935777d82e6963f`，只含18份行情JSON及1份来源清单。

上传提交会触发已配置的Pages工作流：核验ZIP哈希和文件白名单→生成89组行情→运行单元测试及全数据账目核对→生成案例→打包静态网站→部署Pages。任一步失败会停止，不用假数据兜底。生成的数据位于部署产物中，不需要把41MB编译后JS再次提交进Git历史。

## 判断是否成功

在仓库Actions查看 **Deploy CTA Strategy Lab** 的最新运行，只有Deploy步骤成功才算上线。目标地址是 https://xuelixunhua.github.io/cta-strategy-lab/ 。如果已先上传数据而尚未开启Pages，开启后在该工作流点击Run workflow重新运行。

## 本地运行

已有完整工程包及data目录时，直接 `python -m http.server 8000`。只有仓库源码时，先将数据ZIP放根目录，再执行：

```bash
python -m pip install -r requirements-export.txt
python scripts/prepare_data.py
node --test tests/*.test.js
node scripts/audit_data.js
python -m http.server 8000
```

行情许可独立于代码许可；公开上传前由发布者确认相应数据再分发授权。构建脚本只处理经过核验的行情文件，不上传账户、配置或框架源代码。
