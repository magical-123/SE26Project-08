# InfoDigest 大作业测试材料

## 测试方式

本项目采用 JUnit 5、Mockito 和 JaCoCo。

```powershell
cd backend
mvn test '-Dmaven.compiler.useIncrementalCompilation=false'
```

## 本次测试结果

- 测试框架：JUnit 5
- Mock 框架：Mockito（Spring Boot Starter Test 内置）
- 覆盖率工具：JaCoCo 0.8.11
- 测试用例：15 个
- 通过：15 个
- 失败：0 个
- 错误：0 个

## 覆盖模块

- AuthService：注册、重复用户名、无效登录
- JwtUtil：Token 生成、解析和校验
- CredentialCryptoService：AES-GCM 加密、解密、篡改检测
- InformationItemPolicy：标题清洗和元数据标题拦截
- DurationMetrics：真实浏览时长统计
- InsightService：营养占比计算
- AnalysisController：营养统计越权校验
- SocialController：好友请求越权校验

## 交付文件

- `jacoco/`：JaCoCo HTML 覆盖率报告
- `测试报告.md`：测试过程、结果和局限性
- `Mock测试说明.md`：Mockito Mock 对象和验证说明

说明：当前材料覆盖后端核心单元逻辑；Repository、真实 MySQL/Redis、AI 外部接口、前端和浏览器插件属于后续集成测试范围。
