# 销售图片工作台｜Netlify 部署说明

本压缩包是**源码包**，不是可直接拖进 Netlify Drop 的静态网页。注册、个人记录和图片保存需要服务器接口、数据库及文件存储。

## 上传

1. 解压压缩包，将其中 `sales-image-studio` 文件夹上传到你自己的 GitHub 私有仓库。不要上传本机的 `.wrangler`、`.env` 或 `node_modules`。
2. 在 Netlify 选择 **Add new project → Import an existing project → GitHub**，选这个仓库。
3. Base directory 留空；构建命令为 `npm run build:netlify`；发布目录为 `.next`。仓库内 `netlify.toml` 已写好这两项。Node.js 版本为 22。
4. 首次部署后，在 Netlify 站点控制台确认 **Database** 已启用、迁移 `0001_initial.sql` 已执行。应用使用 Netlify Blobs 存储上传的 Logo、二维码和生成的 JPG。
5. 打开分配给你的 `*.netlify.app` 地址，注册一个测试账号，上传 Logo 并生成一张图片；退出再登录，确认记录仍能打开和导出。检查手机浏览器也能访问。

Netlify Database 需要支持该功能的账号方案，可能产生额度消耗。首次部署如果控制台提示启用数据库或选择方案，请按 Netlify 页面完成后重试部署。没有数据库时注册和记录功能无法使用。

## 当前功能与注意

- 五张模板，成品版面 1242 × 2575，高清导出 2484 × 5150 JPG。
- 律所 Logo 保持原色；画面指定色块按 Logo 主色改色。页眉原公司 Logo 保持原色，原版残留蓝线已清理。
- 时间、地址、二维码可编辑；二维码可先留空，后续在个人记录中补传并覆盖生成图。上传含其他信息的截图时，请销售先自行框选二维码。
- 登录采用手机号加自设密码，没有短信验证，也没有自助找回密码。每个账号只查看自己的记录。
- 此包**不含本机测试账号和记录**。第一次上线需要重新注册。

部署文件已在本机通过 TypeScript 和 Next.js 生产构建。Netlify 账号侧的数据库开通和线上上传流程仍需在你的账号下完成验证。
