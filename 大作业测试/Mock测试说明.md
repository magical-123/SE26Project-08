# Mockito Mock 测试说明

## 示例一：认证服务

`AuthServiceTest` 使用 Mock 的 `UserRepository`、`PasswordEncoder` 和 `JwtUtil`，验证注册和登录分支，不调用真实数据库或 JWT 密钥。

## 示例二：权限控制

`AnalysisControllerTest` 使用 Mock 的 `InformationItemRepository` 和 `UserRepository`，验证用户访问其他用户营养统计时返回 403。

`SocialControllerTest` 使用 Mock 的 `FriendshipRepository`，验证非接收者不能接受好友请求，并验证参与者可以拒绝请求。

## 示例三：数据和报告逻辑

`InformationItemPolicyTest` 验证“发布于……”等元数据标题被拒绝；`InsightServiceTest` 验证没有真实浏览时长的内容不会作为真实观看时长参与营养统计。
