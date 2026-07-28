# AI 服务接口使用文档

## 概述

InfoDigest 系统集成了多种 AI 模型服务，用于分析视频内容、生成摘要和洞察报告。系统支持 OpenAI GPT、Anthropic Claude、Google Gemini 以及自定义模型（如 DeepSeek）。

## 架构设计

### 核心组件

1. **AIService** (`com.infodigest.service.AIService`)
   - 负责与各种 AI 模型 API 通信
   - 统一的接口调用和响应处理
   - 支持两种主要场景：内容分析和洞察生成

2. **AIConfig** (`com.infodigest.entity.AIConfig`)
   - 存储用户的 AI 模型配置
   - 表名：`ai_configs`
   - 支持多模型配置

3. **AIConfigController** (`com.infodigest.controller.AIConfigController`)
   - 提供 AI 配置的增删改查接口

## AI 配置管理

### 1. 保存/更新 AI 配置

**接口**: `POST /api/ai-config/save`

**请求体**:
```json
{
  "userId": 1,
  "modelType": "GPT_4",
  "apiKey": "sk-xxxxxxxxxxxx",
  "apiEndpoint": "https://api.openai.com/v1/chat/completions",
  "maxTokens": 2048,
  "customModelName": null
}
```

**支持的模型类型**:
- `CUSTOM` - 自定义兼容 OpenAI 格式的模型

**响应**:
```json
{
  "success": true,
  "message": "AI配置保存成功",
  "userId": 1,
  "modelType": "GPT_4"
}
```

### 2. 获取 AI 配置

**接口**: `GET /api/ai-config/{userId}`

**示例**: `GET /api/ai-config/1`

**响应**:
```json
{
  "userId": 1,
  "modelType": "GPT_4",
  "apiKey": "sk-xxxxxxx...",
  "apiEndpoint": "https://api.openai.com/v1/chat/completions",
  "maxTokens": 2048,
  "customModelName": ""
}
```

**注意**: API Key 会被部分隐藏，只显示前 10 个字符。

### 3. 删除 AI 配置

**接口**: `DELETE /api/ai-config/{userId}`

**示例**: `DELETE /api/ai-config/1`

**响应**:
```json
{
  "success": true,
  "message": "AI配置已删除"
}
```

## AI 服务调用流程

### 流程图

```
用户请求
    ↓
业务Service (InsightService/AnalysisService)
    ↓
AIService.generateInsight() 或 AIService.analyze()
    ↓
从数据库获取用户的 AI 配置 (AIConfig)
    ↓
根据 modelType 路由到相应的 AI 提供商
    ↓
┌─────────────┬──────────────┬──────────────┬──────────────┐
│  OpenAI     │   Claude     │   Gemini     │   Custom     │
│  GPT系列    │  Claude系列   │  Gemini Pro  │  自定义模型   │
└─────────────┴──────────────┴──────────────┴──────────────┘
    ↓
解析 AI 响应
    ↓
返回结构化数据
```

### 使用场景 1: 内容分析

**方法**: `AIService.analyze(AIConfig config, String systemPrompt, String userContent)`

**用途**: 分析视频内容，生成营养成分评分和摘要

**调用示例**:
```java
AIConfig config = aiConfigRepository.findByUserId(userId)
    .orElseThrow(() -> new RuntimeException("用户未配置 AI 模型"));

String systemPrompt = """
    你是一位专业的内容分析师，请分析以下视频内容...
    """;

String userContent = "视频标题：xxx\n视频描述：xxx";

AnalysisResultDTO result = aiService.analyze(config, systemPrompt, userContent);
```

**返回数据结构**:
```java
public class AnalysisResultDTO {
    private Integer protein;      // 蛋白质（深度认知）0-100
    private Integer carbs;         // 碳水化合物（实用技能）0-100
    private Integer vitamins;      // 维生素（创意灵感）0-100
    private Integer fats;          // 脂肪（娱乐消遣）0-100
    private Integer fiber;         // 膳食纤维（哲思反思）0-100
    private String reasoning;      // 评分理由
    private String summary;        // AI 摘要
}
```

### 使用场景 2: 洞察生成

**方法**: `AIService.generateInsight(String prompt, Long userId)`

**用途**: 生成日报/周报洞察

**调用示例**:
```java
String prompt = String.format("""
    你是一位专业的数字内容分析师。请基于用户的视频观看数据生成一份深度洞察报告。
    
    【用户数据】
    - 时间范围：%s
    - 观看视频数量：%d
    - 五维度营养分布：...
    
    请用JSON格式返回：
    {
      "title": "洞察标题",
      "summary": "核心洞察",
      "fullText": "完整洞察内容"
    }
    """, timeRange, videoCount);

String result = aiService.generateInsight(prompt, userId);
```

**返回**: JSON 字符串，需要调用方自行解析

## 各模型提供商的请求格式

### 1. OpenAI (GPT 系列)

**API 端点**: `https://api.openai.com/v1/chat/completions`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {apiKey}
```

**请求体**:
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "系统提示词"
    },
    {
      "role": "user",
      "content": "用户内容"
    }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.3
}
```

**响应解析**:
```java
String content = responseJson
    .get("choices")
    .get(0)
    .get("message")
    .get("content")
    .asText();
```

### 2. Anthropic Claude

**API 端点**: `https://api.anthropic.com/v1/messages`

**请求头**:
```
Content-Type: application/json
x-api-key: {apiKey}
anthropic-version: 2023-06-01
```

**请求体**:
```json
{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 1024,
  "system": "系统提示词",
  "messages": [
    {
      "role": "user",
      "content": "用户内容"
    }
  ]
}
```

**响应解析**:
```java
String content = responseJson
    .get("content")
    .get(0)
    .get("text")
    .asText();
```

### 3. Google Gemini

**API 端点**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`

**请求头**:
```
Content-Type: application/json
```

**URL 参数**: `?key={apiKey}`

**请求体**:
```json
{
  "contents": [{
    "parts": [{
      "text": "系统提示词 + 用户内容"
    }]
  }]
}
```

**响应解析**:
```java
String content = responseJson
    .get("candidates")
    .get(0)
    .get("content")
    .get("parts")
    .get(0)
    .get("text")
    .asText();
```

### 4. 自定义模型 (DeepSeek / CUSTOM)

**API 端点**: 由用户配置的 `apiEndpoint`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {apiKey}
```

**请求体** (兼容 OpenAI 格式):
```json
{
  "model": "{customModelName}",
  "messages": [
    {
      "role": "system",
      "content": "系统提示词"
    },
    {
      "role": "user",
      "content": "用户内容"
    }
  ]
}
```

**响应解析**: 与 OpenAI 相同

## 配置示例

### OpenAI GPT-4 配置

```json
{
  "userId": 1,
  "modelType": "GPT_4",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "apiEndpoint": "https://api.openai.com/v1/chat/completions",
  "maxTokens": 2048,
  "customModelName": null
}
```

### Claude 3 Sonnet 配置

```json
{
  "userId": 1,
  "modelType": "CLAUDE_3_SONNET",
  "apiKey": "sk-ant-xxxxxxxxxxxxxxxx",
  "apiEndpoint": "https://api.anthropic.com/v1/messages",
  "maxTokens": 1024,
  "customModelName": null
}
```

### DeepSeek 配置

```json
{
  "userId": 1,
  "modelType": "deepseek",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "apiEndpoint": "https://api.deepseek.com/v1/chat/completions",
  "maxTokens": 2048,
  "customModelName": "deepseek-chat"
}
```

### 自定义模型配置

```json
{
  "userId": 1,
  "modelType": "CUSTOM",
  "apiKey": "your-api-key",
  "apiEndpoint": "https://your-custom-endpoint.com/v1/chat/completions",
  "maxTokens": 2048,
  "customModelName": "your-model-name"
}
```

## 错误处理

### 常见错误

1. **未配置 AI 模型**
   ```
   RuntimeException: 用户未配置 AI 模型
   ```
   - 解决方案: 先调用 `/api/ai-config/save` 保存配置

2. **API 调用失败**
   ```
   RuntimeException: OpenAI API call failed: 401
   ```
   - 检查 API Key 是否有效
   - 检查 API 端点是否正确
   - 检查账户余额是否充足

3. **不支持的模型类型**
   ```
   IllegalArgumentException: Unsupported model type: XXX
   ```
   - 检查 modelType 是否在支持列表中

4. **JSON 解析失败**
   ```
   Exception: JSON parse error
   ```
   - AI 返回的内容不是有效的 JSON 格式
   - 检查提示词是否明确要求返回 JSON

## 超时和重试

- **连接超时**: 30 秒
- **请求超时**: 60 秒
- **重试策略**: 默认不重试（由调用方决定）

## 安全建议

1. **API Key 保护**
   - 不要在前端代码中直接暴露 API Key
   - 使用后端代理所有 AI 请求
   - 定期轮换 API Key

2. **访问控制**
   - AI 配置接口已在 `SecurityConfig` 中设置为 `permitAll`
   - 生产环境应改为需要认证
   - 确保用户只能访问自己的配置

3. **成本控制**
   - 设置合理的 `maxTokens` 限制
   - 监控 API 调用频率
   - 为用户设置调用配额

## 数据库表结构

### ai_configs 表

```sql
CREATE TABLE ai_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    model_type VARCHAR(50) NOT NULL,
    api_key VARCHAR(500),
    api_endpoint VARCHAR(500),
    max_tokens INT,
    custom_model_name VARCHAR(100)
);
```

## 使用示例代码

### 完整的洞察生成流程

```java
@Service
public class InsightService {
    
    @Autowired
    private AIService aiService;
    
    @Autowired
    private InformationItemRepository itemRepository;
    
    @Autowired
    private UserReportRepository reportRepository;
    
    public UserReport generateInsight(Long userId, ReportType type, LocalDate date) {
        // 1. 获取用户的视频数据
        List<InformationItem> items = itemRepository
            .findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", 
                date.atStartOfDay(), 
                date.atTime(23, 59, 59)
            );
        
        // 2. 计算营养分布
        Map<String, Integer> nutrition = calculateNutrition(items);
        
        // 3. 构建提示词
        String prompt = buildPrompt(items, nutrition, date);
        
        // 4. 调用 AI 服务生成洞察
        String aiResponse = aiService.generateInsight(prompt, userId);
        
        // 5. 解析 AI 响应
        JsonNode json = objectMapper.readTree(aiResponse);
        
        // 6. 保存到数据库
        UserReport report = new UserReport();
        report.setUserId(userId);
        report.setType(type);
        report.setReportDate(date);
        report.setInsightTitle(json.get("title").asText());
        report.setInsightSummary(json.get("summary").asText());
        report.setInsightFullText(json.get("fullText").asText());
        report.setNutritionData(objectMapper.writeValueAsString(nutrition));
        
        return reportRepository.save(report);
    }
}
```

## 总结

InfoDigest 的 AI 服务设计遵循以下原则：

1. **统一接口**: 所有 AI 模型通过统一的 `AIService` 调用
2. **灵活配置**: 支持多种模型，用户可自由选择
3. **安全隔离**: AI Key 存储在后端，前端无法直接访问
4. **易于扩展**: 新增模型只需实现对应的调用方法

使用本文档，开发者可以：
- 配置和管理用户的 AI 模型
- 理解 AI 服务的调用流程
- 集成新的 AI 功能
- 排查常见问题
