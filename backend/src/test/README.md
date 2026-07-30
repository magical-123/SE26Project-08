# WordCloudService Mock 测试文档

## 测试概述

本测试使用 **Mockito** 框架对 `WordCloudService` 进行单元测试，Mock 了所有外部依赖：
- `InformationItemRepository` - 数据访问层
- `UserWordCloudRepository` - 词云数据存储
- `AIService` - AI 服务调用
- `ObjectMapper` - JSON 序列化/反序列化

## 测试用例列表

### 1. 生成词云测试
- ✅ `testGenerateWordCloud_Success` - 成功生成词云
- ✅ `testGenerateWordCloud_NoData` - 无数据场景
- ✅ `testGenerateWordCloud_AIExtractionFailed` - AI 提取失败

### 2. 获取词云数据测试
- ✅ `testGetWordCloud_Success` - 成功获取词云
- ✅ `testGetWordCloud_NotFound` - 数据不存在

### 3. 获取周词云数据测试
- ✅ `testGetWeeklyWordClouds_Success` - 成功获取7天数据
- ✅ `testGetWeeklyWordClouds_EmptyData` - 空数据场景

## 运行测试

### 方法1：使用 Maven 命令行

```bash
cd backend

# 运行所有测试
mvn test

# 运行特定测试类
mvn test -Dtest=WordCloudServiceTest

# 生成测试覆盖率报告
mvn clean test jacoco:report
```

### 方法2：使用 IDEA

1. 右键点击 `WordCloudServiceTest.java`
2. 选择 `Run 'WordCloudServiceTest' with Coverage`
3. 测试完成后，IDEA 会自动显示覆盖率报告

## 查看覆盖率报告

### JaCoCo HTML 报告

测试完成后，报告位置：
```
backend/target/site/jacoco/index.html
```

双击打开即可查看详细的覆盖率报告，包括：
- 行覆盖率（Line Coverage）
- 分支覆盖率（Branch Coverage）
- 方法覆盖率（Method Coverage）
- 类覆盖率（Class Coverage）

### IDEA 覆盖率报告

IDEA 会在编辑器左侧显示：
- 🟢 绿色：代码已被测试覆盖
- 🔴 红色：代码未被测试覆盖
- 🟡 黄色：部分分支被覆盖

## Mock 对象说明

### Mock 的依赖项

1. **InformationItemRepository**
   - Mock 方法：`findByUserIdAndProcessStatusAndAnalyzedAtBetween()`
   - Mock 方法：`findByUserIdAndProcessStatusAndCrawledAtBetween()`
   - 用途：模拟从数据库查询已分析的视频数据

2. **UserWordCloudRepository**
   - Mock 方法：`findByUserIdAndReportDate()`
   - Mock 方法：`findByUserIdAndReportDateBetweenOrderByReportDateDesc()`
   - Mock 方法：`save()`
   - 用途：模拟词云数据的存取操作

3. **AIService**
   - Mock 方法：`generateInsight()`
   - 用途：模拟 AI 关键词提取功能

4. **ObjectMapper**
   - Mock 方法：`readValue()` - JSON 解析
   - Mock 方法：`writeValueAsString()` - JSON 序列化
   - 用途：模拟 JSON 数据转换

## 测试数据准备

测试使用的 Mock 数据：

```java
// 3条视频信息
- ID: 1, 标题: "机器学习入门教程", 完播率: 0.8
- ID: 2, 标题: "深度学习实战", 完播率: 0.9
- ID: 3, 标题: "神经网络原理", 完播率: 0.7

// AI 返回的关键词
- "机器学习" - 关联视频 [1, 2]
- "深度学习" - 关联视频 [2, 3]
```

## 验证点

每个测试用例验证：

1. **返回值正确性**
   - 返回对象不为 null
   - 返回数据字段完整

2. **Mock 方法调用**
   - 验证方法被调用的次数
   - 验证方法参数是否正确

3. **异常处理**
   - 验证异常类型
   - 验证异常消息内容

## 测试覆盖率目标

- 行覆盖率：>= 80%
- 分支覆盖率：>= 70%
- 方法覆盖率：>= 85%

## 注意事项

1. 测试使用 `@ExtendWith(MockitoExtension.class)` 启用 Mockito
2. 使用 `@Mock` 注解标记需要 Mock 的依赖
3. 使用 `@InjectMocks` 注解自动注入 Mock 对象到被测试类
4. 所有测试方法使用 `@Test` 注解标记
5. 使用 `when().thenReturn()` 定义 Mock 行为
6. 使用 `verify()` 验证 Mock 方法调用

## 文件结构

```
backend/
├── src/
│   ├── main/java/com/infodigest/service/
│   │   └── WordCloudService.java          (被测试类)
│   └── test/java/com/infodigest/service/
│       └── WordCloudServiceTest.java      (测试类)
├── target/
│   └── site/jacoco/
│       └── index.html                     (覆盖率报告)
└── pom.xml                                 (添加了 JaCoCo 插件)
```
