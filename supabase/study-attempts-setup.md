# 做题记录跨设备同步设置

网站使用邮箱验证码登录，将已提交的行测整卷、行测单题、全站题库作答和申论复测记录保存到 Supabase。草稿、标记和题目优先级仍保存在设备本机。

## 配置步骤

1. 在 Supabase 创建个人项目，在 SQL Editor 执行仓库内的 `supabase/study-attempts.sql`。
2. 在 Authentication 的邮件模板中启用验证码邮件，正文需包含 `&#123;&#123; .Token &#125;&#125;`。验证码邮件需使用可发送到你的邮箱的 SMTP 服务。
3. 在项目设置中复制 Project URL 和 **Publishable key**。不要使用或公开 Secret / `service_role` key。
4. GitHub Actions 发布工作流已配置 Project URL 和 Publishable key。它们是公开客户端配置，不具备绕过 RLS 的权限；不要改成 Secret / `service_role` key。
5. 重新运行 GitHub Pages 部署。打开网站的“做题记录”，用邮箱验证码登录。
6. 每台设备第一次都要登录一次。那台设备原来保存在本地的记录会与账号合并；以后提交的新记录会自动排队同步，恢复联网后补传。

浏览器里只使用 Publishable key，并且表启用了 RLS，只允许登录账号读取和新增自己的记录。不要把 Supabase Secret、`service_role` key、数据库密码或 SMTP 凭据写进网站代码、GitHub Variables 或发到聊天中。SMTP 凭据只在 Supabase 的邮件服务设置中填写。

云端记录按账号私有保存。请继续保留题目页的 JSON 本地备份作为额外副本；首次同步只会上传各设备上现存的记录，不会从已清理过数据的设备找回记录。
