# Elysia 框架 RBAC 权限控制系统 - v2

> 修复版：解决原设计的所有问题，提供生产可用的实现

## 目录

1. [架构设计](#1-架构设计)
2. [数据库模型](#2-数据库模型)
3. [核心服务层](#3-核心服务层)
4. [HTTP 层集成](#4-http-层集成)
5. [缓存机制](#5-缓存机制)
6. [使用示例](#6-使用示例)
7. [最佳实践](#7-最佳实践)

---

## 1. 架构设计

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Layer (Elysia)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Guard     │  │    Macro    │  │   Admin Routes      │  │
│  │ (模块级)    │  │  (路由级)   │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Authorization Checker                        │
│            (统一权限检查逻辑，消除重复)                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Permission Service Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Permission  │  │  Ownership  │  │   Scope             │  │
│  │ Service     │  │  Service    │  │   Resolver          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Cache       │  │ RBAC Admin  │  │ Prisma Middleware   │  │
│  │ Invalidator │  │ Service     │  │ (自动缓存失效)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Prisma    │  │    Redis    │  │   PostgreSQL        │  │
│  │   Client    │  │    Cache    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **服务层独立** | 核心权限逻辑不依赖 HTTP 框架 |
| **多角色支持** | 用户可拥有多个角色，支持角色继承 |
| **策略化所有权** | 所有权规则可配置、可扩展 |
| **数据范围控制** | 支持行级权限（Scope） |
| **类型安全** | 消除 `any`，使用泛型和类型推断 |
| **统一检查逻辑** | Guard 和 Macro 共用 AuthorizationChecker |
| **自动缓存失效** | Prisma 中间件自动触发缓存更新 |

### 1.3 与原设计对比

| 原问题 | v2 解决方案 |
|--------|-------------|
| 异步初始化时序问题 | `AsyncInitializable` 基类 + `ensureInitialized()` |
| 角色继承性能问题 | 预热角色继承缓存 |
| Scope 条件未应用 | `ScopeResolver` + `buildScopedQuery()` |
| OR 权限检查顺序执行 | `Promise.all()` 并行执行 |
| Guard/Macro 重复代码 | 统一 `AuthorizationChecker` |
| 类型安全问题 | 泛型 + `const` 类型推断 |
| 缓存失效机制缺失 | `CacheInvalidator` + Prisma 中间件 |

---

## 2. 数据库模型

### 2.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========== 用户与角色（多对多） ==========

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String

  // 多角色支持
  userRoles  UserRole[]
  userScopes UserScope[]

  // 资源所有权
  ownedProjects Project[] @relation("ProjectOwner")
  createdTasks  Task[]    @relation("TaskCreator")
  assignedTasks Task[]    @relation("TaskAssignee")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model UserRole {
  id        String    @id @default(uuid())
  userId    String
  roleId    String
  expiresAt DateTime? // 临时权限

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, roleId])
  @@map("user_roles")
}

model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?

  // 关联
  userRoles   UserRole[]
  permissions RolePermission[]

  // 角色继承（支持多级继承）
  parentId String?
  parent   Role?  @relation("RoleHierarchy", fields: [parentId], references: [id])
  children Role[] @relation("RoleHierarchy")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid())
  resource    String   // 资源类型: project, task, user
  action      String   // 操作: create, read, update, delete, manage
  description String?

  roles RolePermission[]

  createdAt DateTime @default(now())

  @@unique([resource, action])
  @@map("permissions")
}

model RolePermission {
  id           String @id @default(uuid())
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

// ========== 所有权策略配置表 ==========

model OwnershipPolicy {
  id        String   @id @default(uuid())
  resource  String   // 资源类型
  field     String   // 所有权字段
  condition String?  // 额外条件（JSON）
  priority  Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([resource, field])
  @@map("ownership_policies")
}

// ========== 数据范围配置 ==========

model ScopePolicy {
  id          String   @id @default(uuid())
  name        String   @unique
  resource    String
  description String?
  conditions  String   // JSON 格式

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userScopes UserScope[]

  @@map("scope_policies")
}

model UserScope {
  id         String  @id @default(uuid())
  userId     String
  scopeId    String
  parameters String? // JSON 格式

  user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  scope ScopePolicy @relation(fields: [scopeId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, scopeId])
  @@map("user_scopes")
}

// ========== 业务模型示例 ==========

model Project {
  id           String        @id @default(uuid())
  name         String
  description  String?
  status       ProjectStatus @default(ACTIVE)
  ownerId      String
  departmentId String?

  owner  User   @relation("ProjectOwner", fields: [ownerId], references: [id])
  tasks  Task[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("projects")
}

model Task {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  projectId   String
  creatorId   String
  assigneeId  String?

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  creator  User    @relation("TaskCreator", fields: [creatorId], references: [id])
  assignee User?   @relation("TaskAssignee", fields: [assigneeId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("tasks")
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  REVIEW
  DONE
}
```

---

## 3. 核心服务层

### 3.1 异步初始化基类

```typescript
// src/services/rbac/base-service.ts

/**
 * 异步初始化基类
 * 解决 constructor 中无法 await 的问题
 */
export abstract class AsyncInitializable {
  private initPromise: Promise<void> | null = null
  private initialized = false

  protected abstract onInitialize(): Promise<void>

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    if (!this.initPromise) {
      this.initPromise = this.onInitialize()
        .then(() => {
          this.initialized = true
        })
        .catch((error) => {
          this.initPromise = null
          throw error
        })
    }

    return this.initPromise
  }

  isInitialized(): boolean {
    return this.initialized
  }

  protected resetInitialization(): void {
    this.initialized = false
    this.initPromise = null
  }
}
```

### 3.2 类型定义

```typescript
// src/services/rbac/types.ts

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'

export interface PermissionCheck<
  R extends string = string,
  A extends PermissionAction = PermissionAction
> {
  resource: R
  action: A
}

export type PermissionString<
  R extends string = string,
  A extends PermissionAction = PermissionAction
> = `${R}:${A}`

export interface PermissionResult {
  allowed: boolean
  reason?: string
  scope?: ScopeContext
}

export interface ScopeContext {
  type: string
  conditions: Record<string, unknown>
  parameters?: Record<string, unknown>
}

export interface OwnershipResult {
  isOwner: boolean
  policy?: string
}

export interface UserPermissionContext {
  userId: string
  roleIds: string[]
  permissions: Set<PermissionString>
  scopes: ScopeContext[]
}

export interface PermissionCache {
  getUserContext(userId: string): Promise<UserPermissionContext | null>
  setUserContext(userId: string, context: UserPermissionContext): Promise<void>
  deleteUserContext(userId: string): Promise<void>
  invalidateByRole?(roleId: string, userIds?: string[]): Promise<void>
  clearAll?(): Promise<void>
}

export const RbacErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const
```

### 3.3 权限服务

```typescript
// src/services/rbac/permission-service.ts

import { db } from '../../db/prisma'
import { AsyncInitializable } from './base-service'
import type { PermissionCache, PermissionCheck, PermissionResult, UserPermissionContext, ScopeContext } from './types'

export class PermissionService extends AsyncInitializable {
  private cache: PermissionCache
  private roleInheritanceCache = new Map<string, Set<string>>()
  private roleDetailsCache = new Map<string, any>()

  constructor(cache: PermissionCache) {
    super()
    this.cache = cache
  }

  protected async onInitialize(): Promise<void> {
    await this.warmupRoleCache()
  }

  private async warmupRoleCache(): Promise<void> {
    const roles = await db.role.findMany({
      include: { permissions: { include: { permission: true } } }
    })

    for (const role of roles) {
      this.roleDetailsCache.set(role.id, role)
    }

    for (const role of roles) {
      if (!this.roleInheritanceCache.has(role.id)) {
        await this.buildInheritanceChain(role.id)
      }
    }
  }

  private async buildInheritanceChain(roleId: string): Promise<Set<string>> {
    const cached = this.roleInheritanceCache.get(roleId)
    if (cached) return cached

    const roleIds = new Set<string>([roleId])
    const role = this.roleDetailsCache.get(roleId)

    if (role?.parentId) {
      const parentChain = await this.buildInheritanceChain(role.parentId)
      parentChain.forEach(id => roleIds.add(id))
    }

    this.roleInheritanceCache.set(roleId, roleIds)
    return roleIds
  }

  async checkPermission(userId: string, check: PermissionCheck): Promise<PermissionResult> {
    await this.ensureInitialized()
    const context = await this.getUserContext(userId)

    if (!context) {
      return { allowed: false, reason: '用户不存在' }
    }

    const required = `${check.resource}:${check.action}`
    const wildcard = `${check.resource}:manage`

    const hasPermission =
      context.permissions.has('*:*') ||
      context.permissions.has(wildcard) ||
      context.permissions.has(required)

    if (!hasPermission) {
      return { allowed: false, reason: `需要 ${required} 权限` }
    }

    const scope = this.getScopeForResource(context, check.resource)
    return { allowed: true, scope }
  }

  // 并行检查所有权限
  async checkAllPermissions(userId: string, checks: PermissionCheck[]): Promise<PermissionResult> {
    await this.ensureInitialized()
    const results = await Promise.all(checks.map(c => this.checkPermission(userId, c)))

    const denied = results.find(r => !r.allowed)
    if (denied) return denied

    const scopes = results.map(r => r.scope).filter(Boolean) as ScopeContext[]
    return { allowed: true, scope: this.mergeScopes(scopes) }
  }

  // 并行检查任一权限
  async checkAnyPermission(userId: string, checks: PermissionCheck[]): Promise<PermissionResult> {
    await this.ensureInitialized()
    const results = await Promise.all(checks.map(c => this.checkPermission(userId, c)))

    const allowed = results.find(r => r.allowed)
    if (allowed) return allowed

    const perms = checks.map(c => `${c.resource}:${c.action}`).join(' 或 ')
    return { allowed: false, reason: `需要以下任一权限: ${perms}` }
  }

  async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    const cached = await this.cache.getUserContext(userId)
    if (cached) return cached

    const context = await this.loadUserContext(userId)
    if (context) {
      await this.cache.setUserContext(userId, context)
    }
    return context
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.deleteUserContext(userId)
  }

  async refreshRoleCache(): Promise<void> {
    this.roleInheritanceCache.clear()
    this.roleDetailsCache.clear()
    await this.warmupRoleCache()
  }

  // ... 其他私有方法省略，见完整实现
}
```

### 3.4 统一授权检查器

```typescript
// src/services/rbac/authorization-checker.ts

export interface AuthorizationConfig {
  permissions?: PermissionCheck[]
  permissionMode?: 'all' | 'any'
  roles?: string[]
  ownership?: { resource: string; paramName?: string }
  allowOwnershipFallback?: boolean
}

export class AuthorizationChecker {
  async check(config: AuthorizationConfig, context: AuthorizationContext): Promise<AuthorizationResult> {
    const { userId, params } = context

    // 1. 角色检查
    if (config.roles?.length) {
      const hasRole = await this.checkRoles(userId, config.roles)
      if (!hasRole) {
        return { allowed: false, code: 403, reason: `需要角色: ${config.roles.join(' 或 ')}` }
      }
    }

    // 2. 权限检查
    if (config.permissions?.length) {
      const result = await this.checkPermissions(
        userId,
        config.permissions,
        config.permissionMode || 'all'
      )

      if (result.allowed) return { allowed: true, code: 200 }

      // 3. 权限不足，尝试所有权检查
      if (config.allowOwnershipFallback && config.ownership) {
        const ownershipResult = await ownershipService.checkOwnership(
          userId, config.ownership.resource, params[config.ownership.paramName || 'id']
        )
        if (ownershipResult.isOwner) return { allowed: true, code: 200 }
      }

      return { allowed: false, code: 403, reason: result.reason }
    }

    // 4. 只有权属检查
    if (config.ownership && !config.permissions) {
      const result = await ownershipService.checkOwnership(
        userId, config.ownership.resource, params[config.ownership.paramName || 'id']
      )
      if (!result.isOwner) {
        return { allowed: false, code: 403, reason: '只能操作自己的资源' }
      }
    }

    return { allowed: true, code: 200 }
  }
}

// 类型安全的配置构建器
export function requirePermission<R extends string>(resource: R, action: PermissionAction): AuthorizationConfig
export function requireAllPermissions<const Checks extends readonly PermissionCheck[]>(...checks: Checks): AuthorizationConfig
export function requireAnyPermission<const Checks extends readonly PermissionCheck[]>(...checks: Checks): AuthorizationConfig
export function requireRole<const Roles extends readonly string[]>(...roles: Roles): AuthorizationConfig
export function requireOwnership<R extends string>(resource: R, paramName?: string): AuthorizationConfig
export function requirePermissionOrOwnership<R extends string>(resource: R, action: PermissionAction, paramName?: string): AuthorizationConfig
```

---

## 4. HTTP 层集成

### 4.1 Guard（模块级保护）

```typescript
// src/http/guard/index.ts

export function createGuard(config: AuthorizationConfig): Elysia {
  const pluginName = `guard:${hashConfig(config)}`

  return new Elysia({ name: pluginName })
    .use(authMiddleware)
    .onBeforeHandle(async ({ user, params, set }) => {
      if (!user) {
        set.status = 401
        return { code: 401, message: '未登录', error: 'UNAUTHORIZED' }
      }

      const checker = getAuthorizationChecker()
      const result = await checker.check(config, {
        userId: user.id,
        params: params as Record<string, string>
      })

      if (!result.allowed) {
        set.status = result.code
        return { code: result.code, message: result.reason, error: 'FORBIDDEN' }
      }
    })
}

// 类型安全的便捷函数
export function guardPermission<R extends string>(resource: R, action: PermissionAction): Elysia
export function guardRole<const Roles extends readonly string[]>(...roles: Roles): Elysia
export function guardOwnership<R extends string>(resource: R, paramName?: string): Elysia
```

### 4.2 Macro（路由级声明）

```typescript
// src/http/macro/index.ts

export const rbacMacros = new Elysia({ name: 'rbac:macros' })
  .use(authMiddleware)
  .macro(({ onBeforeHandle }) => ({
    requireAuth(enabled: boolean) { /* ... */ },
    permission<R extends string>([resource, action]: [R, PermissionAction]) { /* ... */ },
    allPermissions<const Checks extends readonly [string, PermissionAction][]>(checks: Checks) { /* ... */ },
    anyPermission<const Checks extends readonly [string, PermissionAction][]>(checks: Checks) { /* ... */ },
    role<const Roles extends readonly string[]>(roles: Roles) { /* ... */ },
    ownership<R extends string>(config: { resource: R; param?: string }) { /* ... */ },
    permissionOrOwnership<R extends string>(config: {
      permission: [R, PermissionAction]
      resource: R
      param?: string
    }) { /* ... */ }
  }))
```

---

## 5. 缓存机制

### 5.1 缓存失效服务

```typescript
// src/services/rbac/cache-invalidator.ts

export class CacheInvalidator {
  // 用户相关
  async onUserRoleAdded(userId: string, roleId: string): Promise<void>
  async onUserRoleRemoved(userId: string, roleId: string): Promise<void>
  async onUserScopesChanged(userId: string): Promise<void>

  // 角色相关
  async onRolePermissionChanged(roleId: string): Promise<void>
  async onRoleDeleted(roleId: string): Promise<void>

  // 策略相关
  async onOwnershipPolicyChanged(): Promise<void>
  async onScopePolicyChanged(): Promise<void>

  // 核心方法
  async invalidateUserPermission(userId: string): Promise<void>
  async invalidateRoleUsers(roleId: string): Promise<void>
  async invalidateAll(): Promise<void>

  // 批量操作
  async withBatchOperation<T>(operation: () => Promise<T>): Promise<T>
}
```

### 5.2 Prisma 中间件（自动失效）

```typescript
// src/db/prisma-middleware.ts

const RBAC_MODELS = [
  'UserRole', 'RolePermission', 'Role', 'Permission',
  'UserScope', 'ScopePolicy', 'OwnershipPolicy'
]

export const rbacCacheMiddleware: PrismaMiddleware = async (params, next) => {
  const result = await next(params)

  if (shouldInvalidateCache(params)) {
    invalidateCacheAsync(params, result).catch(console.error)
  }

  return result
}

// 使用
prisma.$use(rbacCacheMiddleware)
```

---

## 6. 使用示例

### 6.1 应用启动

```typescript
// src/index.ts

import { Elysia } from 'elysia'
import {
  initializeRbacServices,
  rbacCacheMiddleware
} from './services/rbac'
import { db } from './db/prisma'

async function bootstrap() {
  // 1. 应用 Prisma 中间件
  db.$use(rbacCacheMiddleware)

  // 2. 初始化 RBAC 服务
  await initializeRbacServices({
    redis: redisClient // 可选
  })

  // 3. 启动应用
  const app = new Elysia()
    .use(projectModule)
    .listen(3000)
}

bootstrap()
```

### 6.2 路由示例

```typescript
// 方式一：Macro（推荐单个路由）
new Elysia()
  .use(rbacMacros)
  .get('/projects', handler, { requireAuth: true })
  .post('/projects', handler, { permission: ['project', 'create'] })
  .put('/projects/:id', handler, {
    permissionOrOwnership: {
      permission: ['project', 'update'],
      resource: 'project'
    }
  })

// 方式二：Guard（推荐路由组）
new Elysia()
  .group('/admin', app =>
    app
      .use(createGuard(requireRole('admin')))
      .get('/stats', handler)
      .get('/users', handler)
  )

// 方式三：Scope 查询
const { where, skip, take } = await buildScopedQuery(
  userId,
  { resource: 'project', action: 'read' },
  { status: 'ACTIVE' },
  { page: 1, limit: 20 }
)
const projects = await db.project.findMany({ where, skip, take })
```

### 6.3 管理 API

```typescript
// 角色管理
POST   /admin/rbac/roles              // 创建角色
GET    /admin/rbac/roles              // 角色列表
PUT    /admin/rbac/roles/:id          // 更新角色
DELETE /admin/rbac/roles/:id          // 删除角色

// 权限管理
POST   /admin/rbac/permissions        // 创建权限
GET    /admin/rbac/permissions        // 权限列表

// 角色-权限
POST   /admin/rbac/roles/:roleId/permissions        // 授权
DELETE /admin/rbac/roles/:roleId/permissions/:permId // 撤销

// 用户角色
GET    /admin/rbac/users/:userId/roles  // 用户角色
POST   /admin/rbac/users/:userId/roles  // 分配角色
DELETE /admin/rbac/users/:userId/roles/:roleId // 移除角色

// 缓存管理
POST   /admin/rbac/cache/invalidate     // 清除所有缓存
```

---

## 7. 最佳实践

### 7.1 权限命名规范

```
resource:action  格式

resource: project, task, user, role, permission, *
action:   create, read, update, delete, manage

示例:
- project:create
- project:read
- project:update
- project:delete
- project:manage  (通配，包含所有操作)
- *:*             (超级管理员)
```

### 7.2 角色继承设计

```
super_admin (超级管理员)
    └── admin (管理员)
          └── manager (经理)
                └── member (普通成员)
```

### 7.3 批量操作

```typescript
// 批量操作时使用 withBatchOperation 避免频繁刷新
await cacheInvalidator.withBatchOperation(async () => {
  await assignRoleToUser(user1, 'manager')
  await assignRoleToUser(user2, 'manager')
  await grantPermissionToRole('manager', permissionId)
})
// 所有操作完成后统一刷新缓存
```

### 7.4 错误处理

```typescript
// 统一错误响应格式
{
  "code": 403,
  "message": "需要 project:create 权限",
  "error": "FORBIDDEN"
}
```

---

## 文件结构

```
src/
├── db/
│   └── prisma.ts
├── services/
│   └── rbac/
│       ├── index.ts              # 统一导出
│       ├── types.ts              # 类型定义
│       ├── base-service.ts       # 异步初始化基类
│       ├── cache.ts              # 缓存实现
│       ├── permission-service.ts # 权限服务
│       ├── ownership-service.ts  # 所有权服务
│       ├── scope-resolver.ts     # Scope 解析器
│       ├── scope-helpers.ts      # Scope 工具函数
│       ├── authorization-checker.ts # 统一检查器
│       ├── cache-invalidator.ts  # 缓存失效服务
│       ├── rbac-admin.ts         # 管理服务
│       └── model-helpers.ts      # 类型安全模型
├── http/
│   ├── middleware/
│   │   └── auth.ts
│   ├── guard/
│   │   └── index.ts
│   └── macro/
│       └── index.ts
└── modules/
    └── projects/
        └── index.ts
```

---

## 总结

| 特性 | 状态 |
|------|------|
| 多角色支持 | ✅ |
| 角色继承 | ✅ |
| 所有权检查 | ✅ |
| 数据范围 (Scope) | ✅ |
| 分布式缓存 | ✅ |
| 自动缓存失效 | ✅ |
| 类型安全 | ✅ |
| Guard/Macro 统一 | ✅ |
| 管理 API | ✅ |
