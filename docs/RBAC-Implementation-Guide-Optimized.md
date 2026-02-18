# Elysia 框架 RBAC 权限控制系统 - 优化版

## 目录

1. [架构设计优化](#1-架构设计优化)
2. [数据库模型设计](#2-数据库模型设计)
3. [核心权限服务层](#3-核心权限服务层)
4. [HTTP 层集成](#4-http-层集成)
5. [所有权策略系统](#5-所有权策略系统)
6. [权限范围（Scope）](#6-权限范围scope)
7. [分布式缓存](#7-分布式缓存)
8. [审计日志](#8-审计日志)

---

## 1. 架构设计优化

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Layer (Elysia)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Guard     │  │    Macro    │  │   Error Handler     │  │
│  │ Middleware  │  │  Definition │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Permission Service Layer                   │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Permission     │  │  Ownership   │  │   Scope        │  │
│  │  Checker        │  │  Checker     │  │   Resolver     │  │
│  └─────────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Prisma    │  │    Redis    │  │   Message Queue     │  │
│  │   Client    │  │    Cache    │  │   (Audit Log)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **服务层独立**：核心权限逻辑不依赖 HTTP 框架
2. **多角色支持**：用户可拥有多个角色
3. **真正的角色继承**：自动继承父角色权限
4. **策略化所有权**：所有权规则可配置、可扩展
5. **数据范围控制**：支持行级权限控制
6. **分布式缓存**：支持多实例部署

---

## 2. 数据库模型设计

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
  password  String   // 加密存储
  
  // 多角色支持
  userRoles UserRole[]
  
  // 资源所有权
  ownedProjects Project[] @relation("ProjectOwner")
  createdTasks  Task[]    @relation("TaskCreator")
  assignedTasks Task[]    @relation("TaskAssignee")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model UserRole {
  id     String @id @default(uuid())
  userId String
  roleId String
  
  // 可选：角色有效期（临时权限）
  expiresAt DateTime?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  
  @@unique([userId, roleId])
  @@map("user_roles")
}

model Role {
  id          String       @id @default(uuid())
  name        String       @unique
  description String?
  
  // 关联
  userRoles   UserRole[]
  permissions RolePermission[]
  
  // 角色继承（支持多级继承）
  parentId    String?
  parent      Role?        @relation("RoleHierarchy", fields: [parentId], references: [id])
  children    Role[]       @relation("RoleHierarchy")
  
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid())
  resource    String   // 资源类型: project, task, user, etc.
  action      String   // 操作类型: create, read, update, delete, manage
  description String?
  
  // 关联
  roles       RolePermission[]
  
  createdAt   DateTime @default(now())

  @@unique([resource, action])
  @@map("permissions")
}

// 角色-权限中间表（支持未来扩展，如权限有效期、条件等）
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
  id         String   @id @default(uuid())
  resource   String   // 资源类型: project, task
  field      String   // 所有权字段: ownerId, creatorId, assigneeId
  condition  String?  // 额外条件（JSON 格式）
  priority   Int      @default(0) // 优先级，数字小的先检查
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([resource, field])
  @@map("ownership_policies")
}

// ========== 数据范围配置 ==========

model ScopePolicy {
  id          String   @id @default(uuid())
  name        String   @unique
  resource    String   // 资源类型
  description String?
  
  // 范围定义（JSON 格式，存储查询条件模板）
  conditions  String
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("scope_policies")
}

// 用户-范围关联（哪些用户拥有哪些数据范围）
model UserScope {
  id          String @id @default(uuid())
  userId      String
  scopeId     String
  
  // 可选：范围参数（如部门 ID）
  parameters  String?
  
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  scope  ScopePolicy @relation(fields: [scopeId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  
  @@unique([userId, scopeId])
  @@map("user_scopes")
}

// ========== 业务模型 ==========

model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  
  // 所有权
  ownerId     String
  owner       User     @relation("ProjectOwner", fields: [ownerId], references: [id])
  
  // 可选：所属部门（用于范围控制）
  departmentId String?
  
  // 关联
  tasks       Task[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("projects")
}

model Task {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  
  // 关联
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  creatorId   String
  creator     User       @relation("TaskCreator", fields: [creatorId], references: [id])
  
  assigneeId  String?
  assignee    User?      @relation("TaskAssignee", fields: [assigneeId], references: [id])
  
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("tasks")
}

// ========== 审计日志（消息队列消费者写入） ==========

model AuditLog {
  id          String   @id @default(uuid())
  userId      String?
  action      String   // HTTP 方法或操作名
  resource    String   // 访问的资源
  resourceId  String?  // 资源 ID
  ip          String
  userAgent   String
  success     Boolean
  error       String?
  
  // 请求详情（JSON）
  metadata    String?
  
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([resource, action])
  @@map("audit_logs")
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

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

---

## 3. 核心权限服务层

### 3.1 类型定义

```typescript
// src/services/rbac/types.ts

export interface PermissionCheck {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
}

export type PermissionString = `${string}:${string}`

// 权限检查结果
export interface PermissionResult {
  allowed: boolean
  reason?: string
  scope?: ScopeContext  // 如果有数据范围限制
}

// 数据范围上下文
export interface ScopeContext {
  type: string
  conditions: Record<string, any>
}

// 所有权检查结果
export interface OwnershipResult {
  isOwner: boolean
  policy?: string
}

// 用户权限上下文（从缓存或数据库加载）
export interface UserPermissionContext {
  userId: string
  roleIds: string[]
  permissions: Set<PermissionString>
  scopes: ScopeContext[]
}
```

### 3.2 核心权限服务（框架无关）

```typescript
// src/services/rbac/permission-service.ts

import { db } from '../../db/prisma'
import type { 
  PermissionCheck, 
  PermissionResult, 
  UserPermissionContext,
  ScopeContext 
} from './types'

export class PermissionService {
  private cache: PermissionCache
  
  constructor(cache: PermissionCache) {
    this.cache = cache
  }
  
  /**
   * 检查用户是否拥有指定权限
   * 支持多角色和角色继承
   */
  async checkPermission(
    userId: string,
    check: PermissionCheck
  ): Promise<PermissionResult> {
    const context = await this.getUserContext(userId)
    
    if (!context) {
      return { allowed: false, reason: '用户不存在' }
    }
    
    const required = `${check.resource}:${check.action}`
    const wildcard = `${check.resource}:manage`
    
    // 检查是否有通配权限或具体权限
    const hasPermission = context.permissions.has('*:*') ||
                          context.permissions.has(wildcard) ||
                          context.permissions.has(required)
    
    if (!hasPermission) {
      return { 
        allowed: false, 
        reason: `需要 ${required} 权限` 
      }
    }
    
    // 检查是否有数据范围限制
    const scope = this.getScopeForResource(context, check.resource)
    
    return { allowed: true, scope }
  }
  
  /**
   * 检查多个权限（AND 关系）
   */
  async checkAllPermissions(
    userId: string,
    checks: PermissionCheck[]
  ): Promise<PermissionResult> {
    const results = await Promise.all(
      checks.map(c => this.checkPermission(userId, c))
    )
    
    const denied = results.find(r => !r.allowed)
    if (denied) {
      return denied
    }
    
    // 合并所有范围限制（取交集）
    const scopes = results.map(r => r.scope).filter(Boolean) as ScopeContext[]
    
    return { 
      allowed: true, 
      scope: this.mergeScopes(scopes) 
    }
  }
  
  /**
   * 检查任一权限（OR 关系）
   */
  async checkAnyPermission(
    userId: string,
    checks: PermissionCheck[]
  ): Promise<PermissionResult> {
    for (const check of checks) {
      const result = await this.checkPermission(userId, check)
      if (result.allowed) {
        return result
      }
    }
    
    const perms = checks.map(c => `${c.resource}:${c.action}`).join(' 或 ')
    return { 
      allowed: false, 
      reason: `需要以下任一权限: ${perms}` 
    }
  }
  
  /**
   * 检查用户角色
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const context = await this.getUserContext(userId)
    if (!context) return false
    
    // 检查用户是否有该角色（包括继承的角色）
    const userRoles = await this.getUserRoleNames(userId)
    return userRoles.includes(roleName)
  }
  
  /**
   * 获取用户权限上下文（带缓存）
   */
  private async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    // 1. 尝试从缓存获取
    const cached = await this.cache.getUserContext(userId)
    if (cached) return cached
    
    // 2. 从数据库加载
    const context = await this.loadUserContext(userId)
    if (context) {
      await this.cache.setUserContext(userId, context)
    }
    
    return context
  }
  
  /**
   * 从数据库加载用户权限上下文
   * 包含多角色和角色继承
   */
  private async loadUserContext(userId: string): Promise<UserPermissionContext | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        },
        userScopes: {
          include: { scope: true }
        }
      }
    })
    
    if (!user) return null
    
    // 收集所有角色 ID（递归获取继承的角色）
    const roleIds: string[] = []
    const allPermissions = new Set<string>()
    
    for (const userRole of user.userRoles) {
      const roleWithInheritance = await this.getRoleWithInheritance(userRole.roleId)
      for (const role of roleWithInheritance) {
        roleIds.push(role.id)
        for (const rp of role.permissions) {
          allPermissions.add(`${rp.permission.resource}:${rp.permission.action}`)
        }
      }
    }
    
    // 解析数据范围
    const scopes = user.userScopes.map(us => ({
      type: us.scope.name,
      conditions: JSON.parse(us.scope.conditions),
      parameters: us.parameters ? JSON.parse(us.parameters) : undefined
    }))
    
    return {
      userId: user.id,
      roleIds: [...new Set(roleIds)], // 去重
      permissions: allPermissions,
      scopes
    }
  }
  
  /**
   * 递归获取角色及其所有祖先角色
   */
  private async getRoleWithInheritance(roleId: string): Promise<any[]> {
    const roles: any[] = []
    const visited = new Set<string>()
    
    const loadRole = async (id: string) => {
      if (visited.has(id)) return
      visited.add(id)
      
      const role = await db.role.findUnique({
        where: { id },
        include: {
          permissions: { include: { permission: true } }
        }
      })
      
      if (role) {
        roles.push(role)
        // 递归加载父角色
        if (role.parentId) {
          await loadRole(role.parentId)
        }
      }
    }
    
    await loadRole(roleId)
    return roles
  }
  
  /**
   * 获取用户的所有角色名称（包括继承的）
   */
  private async getUserRoleNames(userId: string): Promise<string[]> {
    const context = await this.getUserContext(userId)
    if (!context) return []
    
    const roles = await db.role.findMany({
      where: { id: { in: context.roleIds } },
      select: { name: true }
    })
    
    return roles.map(r => r.name)
  }
  
  /**
   * 获取资源对应的数据范围
   */
  private getScopeForResource(
    context: UserPermissionContext, 
    resource: string
  ): ScopeContext | undefined {
    return context.scopes.find(s => s.conditions.resource === resource)
  }
  
  /**
   * 合并多个范围限制（取交集）
   */
  private mergeScopes(scopes: ScopeContext[]): ScopeContext | undefined {
    if (scopes.length === 0) return undefined
    if (scopes.length === 1) return scopes[0]
    
    // 简单的合并策略：AND 连接所有条件
    return {
      type: 'merged',
      conditions: {
        AND: scopes.map(s => s.conditions)
      }
    }
  }
  
  /**
   * 清除用户权限缓存
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.deleteUserContext(userId)
  }
}
```

### 3.3 所有权检查服务

```typescript
// src/services/rbac/ownership-service.ts

import { db } from '../../db/prisma'
import type { OwnershipResult } from './types'

export class OwnershipService {
  private policies: Map<string, OwnershipPolicy[]>
  
  constructor() {
    this.policies = new Map()
    this.loadPolicies()
  }
  
  /**
   * 从数据库加载所有权策略
   */
  private async loadPolicies(): Promise<void> {
    const policies = await db.ownershipPolicy.findMany({
      orderBy: { priority: 'asc' }
    })
    
    for (const policy of policies) {
      const list = this.policies.get(policy.resource) || []
      list.push(policy)
      this.policies.set(policy.resource, list)
    }
  }
  
  /**
   * 刷新策略缓存
   */
  async refreshPolicies(): Promise<void> {
    this.policies.clear()
    await this.loadPolicies()
  }
  
  /**
   * 检查用户是否是资源的所有者
   */
  async checkOwnership(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<OwnershipResult> {
    const policies = this.policies.get(resourceType) || []
    
    for (const policy of policies) {
      const isOwner = await this.checkPolicy(userId, resourceId, policy)
      if (isOwner) {
        return { isOwner: true, policy: policy.field }
      }
    }
    
    return { isOwner: false }
  }
  
  /**
   * 获取资源的查询条件（用于列表查询）
   * 返回 null 表示用户不是任何资源的所有者
   */
  async getOwnershipConditions(
    userId: string,
    resourceType: string
  ): Promise<any | null> {
    const policies = this.policies.get(resourceType) || []
    const conditions: any[] = []
    
    for (const policy of policies) {
      const condition = this.buildOwnershipCondition(userId, policy)
      if (condition) {
        conditions.push(condition)
      }
    }
    
    if (conditions.length === 0) {
      return null
    }
    
    return conditions.length === 1 ? conditions[0] : { OR: conditions }
  }
  
  /**
   * 检查单个策略
   */
  private async checkPolicy(
    userId: string,
    resourceId: string,
    policy: OwnershipPolicy
  ): Promise<boolean> {
    const model = this.getModel(policy.resource)
    if (!model) return false
    
    const resource = await (model as any).findUnique({
      where: { id: resourceId },
      select: { [policy.field]: true }
    })
    
    if (!resource) return false
    
    // 检查所有权字段
    if (resource[policy.field] === userId) {
      return true
    }
    
    // 检查额外条件（如项目成员）
    if (policy.condition) {
      const condition = JSON.parse(policy.condition)
      return await this.evaluateCondition(userId, resourceId, condition)
    }
    
    return false
  }
  
  /**
   * 构建所有权查询条件
   */
  private buildOwnershipCondition(
    userId: string,
    policy: OwnershipPolicy
  ): any | null {
    const baseCondition = { [policy.field]: userId }
    
    if (policy.condition) {
      // 复杂条件暂时返回 baseCondition
      // 实际项目中可以解析 condition 构建更复杂的查询
      return baseCondition
    }
    
    return baseCondition
  }
  
  /**
   * 获取 Prisma 模型
   */
  private getModel(resourceType: string): any {
    const modelMap: Record<string, any> = {
      project: db.project,
      task: db.task
    }
    return modelMap[resourceType]
  }
  
  /**
   * 评估额外条件
   */
  private async evaluateCondition(
    userId: string,
    resourceId: string,
    condition: any
  ): Promise<boolean> {
    // 实现条件评估逻辑
    // 例如：检查用户是否是项目成员
    return false
  }
}

interface OwnershipPolicy {
  id: string
  resource: string
  field: string
  condition: string | null
  priority: number
}
```

### 3.4 分布式缓存实现

```typescript
// src/services/rbac/cache.ts

import type { UserPermissionContext } from './types'

export interface PermissionCache {
  getUserContext(userId: string): Promise<UserPermissionContext | null>
  setUserContext(userId: string, context: UserPermissionContext): Promise<void>
  deleteUserContext(userId: string): Promise<void>
}

// Redis 实现（支持分布式部署）
export class RedisPermissionCache implements PermissionCache {
  private redis: Redis
  private ttl: number
  
  constructor(redis: Redis, ttlSeconds: number = 300) {
    this.redis = redis
    this.ttl = ttlSeconds
  }
  
  async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    const key = `rbac:user:${userId}`
    const data = await this.redis.get(key)
    
    if (!data) return null
    
    try {
      const parsed = JSON.parse(data)
      // 还原 Set 类型
      return {
        ...parsed,
        permissions: new Set(parsed.permissions)
      }
    } catch {
      return null
    }
  }
  
  async setUserContext(
    userId: string, 
    context: UserPermissionContext
  ): Promise<void> {
    const key = `rbac:user:${userId}`
    const data = JSON.stringify({
      ...context,
      permissions: Array.from(context.permissions)
    })
    
    await this.redis.setex(key, this.ttl, data)
  }
  
  async deleteUserContext(userId: string): Promise<void> {
    const key = `rbac:user:${userId}`
    await this.redis.del(key)
  }
  
  /**
   * 批量清除缓存（角色变更时）
   */
  async invalidateByRole(roleId: string): Promise<void> {
    // 使用 Redis 的 scan 查找相关 key
    // 或者使用 pub/sub 通知所有实例
    const pattern = 'rbac:user:*'
    // 实现批量删除逻辑
  }
}

// 内存缓存实现（单实例部署时使用）
export class MemoryPermissionCache implements PermissionCache {
  private cache = new Map<string, { data: UserPermissionContext; expires: number }>()
  private ttl: number
  
  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000
    this.startCleanup()
  }
  
  async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    const entry = this.cache.get(userId)
    if (!entry) return null
    
    if (Date.now() > entry.expires) {
      this.cache.delete(userId)
      return null
    }
    
    return entry.data
  }
  
  async setUserContext(
    userId: string, 
    context: UserPermissionContext
  ): Promise<void> {
    this.cache.set(userId, {
      data: context,
      expires: Date.now() + this.ttl
    })
  }
  
  async deleteUserContext(userId: string): Promise<void> {
    this.cache.delete(userId)
  }
  
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expires) {
          this.cache.delete(key)
        }
      }
    }, 60000)
  }
}
```

---

## 4. HTTP 层集成

### 4.1 认证中间件

```typescript
// src/http/middleware/auth.ts

import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { db } from '../../db/prisma'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
}

export const authMiddleware = new Elysia({ name: 'auth' })
  .use(bearer())
  .use(jwt({
    secret: process.env.JWT_SECRET!,
    exp: '7d'
  }))
  .derive(async ({ jwt, bearer, request }): Promise<{
    user: AuthenticatedUser | null
  }> => {
    // 公开路径
    const publicPaths = ['/auth/login', '/auth/register', '/docs', '/health']
    if (publicPaths.some(path => request.url.includes(path))) {
      return { user: null }
    }
    
    if (!bearer) {
      return { user: null }
    }
    
    try {
      const payload = await jwt.verify(bearer) as { userId: string }
      
      if (!payload?.userId) {
        return { user: null }
      }
      
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true }
      })
      
      return { user }
    } catch {
      return { user: null }
    }
  })
```

### 4.2 统一权限守卫

```typescript
// src/http/guard/index.ts

import { Elysia, error } from 'elysia'
import { authMiddleware, type AuthenticatedUser } from '../middleware/auth'
import { permissionService, ownershipService } from '../../services/rbac'
import type { PermissionCheck } from '../../services/rbac/types'

interface GuardOptions {
  permissions?: PermissionCheck[]
  permissionMode?: 'all' | 'any'
  roles?: string[]
  ownership?: {
    resource: string
    paramName?: string  // 默认 'id'
  }
  scope?: string      // 数据范围类型
}

/**
 * 统一权限守卫
 * 支持：权限检查、角色检查、所有权检查、数据范围
 */
export const createGuard = (options: GuardOptions) => {
  return new Elysia({ name: `guard:${JSON.stringify(options)}` })
    .use(authMiddleware)
    .onBeforeHandle(async ({ user, params, set }) => {
      // 1. 检查登录
      if (!user) {
        set.status = 401
        return error(401, { code: 401, message: '未登录' })
      }
      
      // 2. 检查角色
      if (options.roles && options.roles.length > 0) {
        const hasRole = await permissionService.hasRole(user.id, options.roles[0])
        if (!hasRole) {
          // 检查其他角色...
          const hasAnyRole = await Promise.all(
            options.roles.map(r => permissionService.hasRole(user.id, r))
          ).then(results => results.some(Boolean))
          
          if (!hasAnyRole) {
            set.status = 403
            return error(403, {
              code: 403,
              message: `需要角色: ${options.roles.join(' 或 ')}`
            })
          }
        }
      }
      
      // 3. 检查权限
      if (options.permissions && options.permissions.length > 0) {
        let result
        
        if (options.permissionMode === 'any') {
          result = await permissionService.checkAnyPermission(user.id, options.permissions)
        } else {
          result = await permissionService.checkAllPermissions(user.id, options.permissions)
        }
        
        if (!result.allowed) {
          // 4. 权限检查失败，尝试所有权检查
          if (options.ownership) {
            const resourceId = params[options.ownership.paramName || 'id']
            const ownership = await ownershipService.checkOwnership(
              user.id,
              options.ownership.resource,
              resourceId
            )
            
            if (!ownership.isOwner) {
              set.status = 403
              return error(403, {
                code: 403,
                message: result.reason || '无权限访问此资源'
              })
            }
          } else {
            set.status = 403
            return error(403, {
              code: 403,
              message: result.reason || '无权限'
            })
          }
        }
      } else if (options.ownership) {
        // 只有所有权检查
        const resourceId = params[options.ownership.paramName || 'id']
        const ownership = await ownershipService.checkOwnership(
          user.id,
          options.ownership.resource,
          resourceId
        )
        
        if (!ownership.isOwner) {
          set.status = 403
          return error(403, {
            code: 403,
            message: '只能访问自己的资源'
          })
        }
      }
    })
}

// 便捷函数
export const requirePermission = (resource: string, action: string) =>
  createGuard({ permissions: [{ resource, action }] })

export const requireAnyPermission = (...permissions: PermissionCheck[]) =>
  createGuard({ permissions, permissionMode: 'any' })

export const requireAllPermissions = (...permissions: PermissionCheck[]) =>
  createGuard({ permissions, permissionMode: 'all' })

export const requireRole = (...roles: string[]) =>
  createGuard({ roles })

export const requireOwnership = (resource: string, paramName?: string) =>
  createGuard({ ownership: { resource, paramName } })

export const requirePermissionOrOwnership = (
  resource: string,
  action: string,
  paramName?: string
) =>
  createGuard({
    permissions: [{ resource, action }],
    ownership: { resource, paramName }
  })
```

### 4.3 Elysia 宏定义（统一使用宏）

```typescript
// src/http/macro/index.ts

import { Elysia } from 'elysia'
import { authMiddleware } from '../middleware/auth'
import { permissionService, ownershipService } from '../../services/rbac'
import type { PermissionCheck } from '../../services/rbac/types'

/**
 * RBAC 宏 - 提供声明式权限控制
 * 统一使用宏，不再使用单独的守卫中间件
 */
export const rbacMacros = new Elysia({ name: 'rbac:macros' })
  .use(authMiddleware)
  .macro(({ onBeforeHandle }) => ({
    /**
     * 登录检查
     * 使用: requireAuth: true
     */
    requireAuth(enabled: boolean) {
      if (!enabled) return
      
      onBeforeHandle(async ({ user, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
      })
    },
    
    /**
     * 权限检查
     * 使用: permission: ['project', 'create']
     */
    permission([resource, action]: [string, string]) {
      onBeforeHandle(async ({ user, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        const result = await permissionService.checkPermission(user.id, {
          resource,
          action: action as any
        })
        
        if (!result.allowed) {
          return error(403, {
            code: 403,
            message: result.reason || `需要 ${resource}:${action} 权限`
          })
        }
      })
    },
    
    /**
     * 多个权限（AND）
     * 使用: allPermissions: [['project', 'create'], ['task', 'create']]
     */
    allPermissions(checks: [string, string][]) {
      onBeforeHandle(async ({ user, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        const result = await permissionService.checkAllPermissions(
          user.id,
          checks.map(([r, a]) => ({ resource: r, action: a as any }))
        )
        
        if (!result.allowed) {
          return error(403, {
            code: 403,
            message: result.reason || '权限不足'
          })
        }
      })
    },
    
    /**
     * 任一权限（OR）
     * 使用: anyPermission: [['project', 'delete'], ['project', 'manage']]
     */
    anyPermission(checks: [string, string][]) {
      onBeforeHandle(async ({ user, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        const result = await permissionService.checkAnyPermission(
          user.id,
          checks.map(([r, a]) => ({ resource: r, action: a as any }))
        )
        
        if (!result.allowed) {
          return error(403, {
            code: 403,
            message: result.reason || '权限不足'
          })
        }
      })
    },
    
    /**
     * 角色检查
     * 使用: role: ['admin']
     */
    role(roles: string[]) {
      onBeforeHandle(async ({ user, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        const hasRole = await Promise.all(
          roles.map(r => permissionService.hasRole(user.id, r))
        ).then(results => results.some(Boolean))
        
        if (!hasRole) {
          return error(403, {
            code: 403,
            message: `需要角色: ${roles.join(' 或 ')}`
          })
        }
      })
    },
    
    /**
     * 所有权检查
     * 使用: ownership: { resource: 'project', param: 'id' }
     */
    ownership(config: { resource: string; param?: string }) {
      onBeforeHandle(async ({ user, params, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        // 管理员跳过
        const isAdmin = await permissionService.hasRole(user.id, 'admin')
        if (isAdmin) return
        
        const resourceId = params[config.param || 'id']
        const result = await ownershipService.checkOwnership(
          user.id,
          config.resource,
          resourceId
        )
        
        if (!result.isOwner) {
          return error(403, {
            code: 403,
            message: '只能操作自己的资源'
          })
        }
      })
    },
    
    /**
     * 权限或所有权
     * 使用: permissionOrOwnership: { permission: ['project', 'update'], resource: 'project' }
     */
    permissionOrOwnership(config: {
      permission: [string, string]
      resource: string
      param?: string
    }) {
      onBeforeHandle(async ({ user, params, error }) => {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }
        
        // 先检查权限
        const [resource, action] = config.permission
        const permResult = await permissionService.checkPermission(user.id, {
          resource,
          action: action as any
        })
        
        if (permResult.allowed) return
        
        // 再检查所有权
        const resourceId = params[config.param || 'id']
        const ownership = await ownershipService.checkOwnership(
          user.id,
          config.resource,
          resourceId
        )
        
        if (!ownership.isOwner) {
          return error(403, {
            code: 403,
            message: `需要 ${resource}:${action} 权限或是资源所有者`
          })
        }
      })
    }
  }))
```

### 4.4 使用示例

```typescript
// src/modules/projects/index.ts

import { Elysia, t } from 'elysia'
import { rbacMacros } from '../../http/macro'
import { authMiddleware } from '../../http/middleware/auth'
import { permissionService, ownershipService } from '../../services/rbac'
import { db } from '../../db/prisma'

export const projectModule = new Elysia({ prefix: '/projects' })
  .use(authMiddleware)
  .use(rbacMacros)
  
  // ========== 列表查询（带数据范围）==========
  .get('/', async ({ user, query }) => {
    const { status, page = 1, limit = 20 } = query
    
    // 构建查询条件
    const where: any = {}
    if (status) where.status = status
    
    // 检查用户权限和数据范围
    const isAdmin = await permissionService.hasRole(user.id, 'admin')
    const permResult = await permissionService.checkPermission(user.id, {
      resource: 'project',
      action: 'read'
    })
    
    if (!isAdmin && permResult.scope) {
      // 应用数据范围限制
      if (permResult.scope.conditions.departmentId) {
        where.departmentId = permResult.scope.conditions.departmentId
      }
    } else if (!isAdmin) {
      // 无全局读取权限，只能看自己的
      const ownershipCondition = await ownershipService.getOwnershipConditions(
        user.id,
        'project'
      )
      if (ownershipCondition) {
        Object.assign(where, ownershipCondition)
      } else {
        return { projects: [], total: 0 }
      }
    }
    
    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: { select: { id: true, name: true } } }
      }),
      db.project.count({ where })
    ])
    
    return { projects, total, page, limit }
  }, {
    requireAuth: true,
    query: t.Object({
      status: t.Optional(t.Union([t.Literal('ACTIVE'), t.Literal('ARCHIVED')])),
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric())
    })
  })
  
  // ========== 创建项目 ==========
  .post('/', async ({ body, user }) => {
    const project = await db.project.create({
      data: {
        ...body,
        ownerId: user.id
      },
      include: { owner: { select: { id: true, name: true, email: true } } }
    })
    return { project }
  }, {
    permission: ['project', 'create'],
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 500 })),
      departmentId: t.Optional(t.String())
    })
  })
  
  // ========== 获取详情 ==========
  .get('/:id', async ({ params }) => {
    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tasks: { select: { id: true, title: true, status: true } }
      }
    })
    
    if (!project) {
      return error(404, { code: 404, message: '项目不存在' })
    }
    
    return { project }
  }, {
    requireAuth: true,
    params: t.Object({ id: t.String() })
  })
  
  // ========== 更新项目（权限或所有权）==========
  .put('/:id', async ({ params, body }) => {
    const project = await db.project.update({
      where: { id: params.id },
      data: body
    })
    return { project }
  }, {
    permissionOrOwnership: {
      permission: ['project', 'update'],
      resource: 'project'
    },
    body: t.Partial(t.Object({
      name: t.String({ minLength: 1 }),
      description: t.String(),
      status: t.Union([t.Literal('ACTIVE'), t.Literal('ARCHIVED')])
    }))
  })
  
  // ========== 删除项目（需要高级权限）==========
  .delete('/:id', async ({ params }) => {
    await db.project.delete({ where: { id: params.id } })
    return { message: '删除成功' }
  }, {
    anyPermission: [['project', 'delete'], ['project', 'manage']]
  })
```

---

## 5. 所有权策略系统

### 5.1 策略配置示例

```typescript
// src/config/ownership-policies.ts

import { db } from '../db/prisma'

/**
 * 初始化所有权策略
 * 在应用启动时运行
 */
export async function initOwnershipPolicies(): Promise<void> {
  const policies = [
    // 项目所有权策略
    {
      resource: 'project',
      field: 'ownerId',
      priority: 1
    },
    
    // 任务所有权策略
    {
      resource: 'task',
      field: 'creatorId',
      priority: 1
    },
    {
      resource: 'task',
      field: 'assigneeId',
      priority: 2
    },
    {
      resource: 'task',
      field: 'projectId',
      condition: JSON.stringify({
        // 通过 project.ownerId 关联检查
        relation: 'project',
        field: 'ownerId'
      }),
      priority: 3
    }
  ]
  
  for (const policy of policies) {
    await db.ownershipPolicy.upsert({
      where: {
        resource_field: {
          resource: policy.resource,
          field: policy.field
        }
      },
      update: policy,
      create: policy
    })
  }
}
```

---

## 6. 权限范围（Scope）

### 6.1 范围配置

```typescript
// src/config/scope-policies.ts

import { db } from '../db/prisma'

/**
 * 初始化数据范围策略
 */
export async function initScopePolicies(): Promise<void> {
  const scopes = [
    {
      name: 'own_department',
      resource: 'project',
      description: '只能查看本部门的项目',
      conditions: JSON.stringify({
        resource: 'project',
        filter: 'departmentId = :departmentId'
      })
    },
    {
      name: 'own_team',
      resource: 'task',
      description: '只能查看本团队的任务',
      conditions: JSON.stringify({
        resource: 'task',
        filter: 'teamId IN (:teamIds)'
      })
    }
  ]
  
  for (const scope of scopes) {
    await db.scopePolicy.upsert({
      where: { name: scope.name },
      update: scope,
      create: scope
    })
  }
}
```

### 6.2 使用数据范围

```typescript
// 在权限检查中获取数据范围
const result = await permissionService.checkPermission(user.id, {
  resource: 'project',
  action: 'read'
})

if (result.allowed && result.scope) {
  // 应用数据范围到查询
  const projects = await db.project.findMany({
    where: {
      departmentId: result.scope.conditions.departmentId
    }
  })
}
```

---

## 7. 分布式缓存

### 7.1 缓存配置

```typescript
// src/config/cache.ts

import Redis from 'ioredis'
import { RedisPermissionCache, MemoryPermissionCache } from '../services/rbac/cache'

export function createCache() {
  if (process.env.REDIS_URL) {
    // 分布式缓存（生产环境）
    const redis = new Redis(process.env.REDIS_URL)
    return new RedisPermissionCache(redis, 300) // 5 分钟 TTL
  } else {
    // 内存缓存（开发环境）
    return new MemoryPermissionCache(300)
  }
}
```

### 7.2 缓存失效策略

```typescript
// src/services/rbac/cache-invalidator.ts

import { db } from '../../db/prisma'

/**
 * 当角色或权限变更时，清除相关用户缓存
 */
export async function invalidateRoleCache(roleId: string): Promise<void> {
  // 获取所有拥有该角色的用户
  const userRoles = await db.userRole.findMany({
    where: { roleId },
    select: { userId: true }
  })
  
  // 清除缓存
  for (const { userId } of userRoles) {
    await permissionCache.deleteUserContext(userId)
  }
}

/**
 * 用户角色变更时清除缓存
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await permissionCache.deleteUserContext(userId)
}
```

---

## 8. 审计日志

### 8.1 异步审计日志服务

```typescript
// src/services/audit/index.ts

import { db } from '../../db/prisma'

interface AuditLogEntry {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  ip: string
  userAgent: string
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

/**
 * 审计日志服务
 * 使用异步方式写入，不阻塞主流程
 */
export class AuditService {
  private buffer: AuditLogEntry[] = []
  private flushInterval: NodeJS.Timeout
  
  constructor() {
    // 每 5 秒批量写入一次
    this.flushInterval = setInterval(() => this.flush(), 5000)
  }
  
  /**
   * 记录审计日志（异步，不阻塞）
   */
  log(entry: AuditLogEntry): void {
    this.buffer.push(entry)
    
    // 缓冲区满时立即写入
    if (this.buffer.length >= 100) {
      this.flush()
    }
  }
  
  /**
   * 批量写入数据库
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    
    const entries = [...this.buffer]
    this.buffer = []
    
    try {
      await db.auditLog.createMany({
        data: entries.map(e => ({
          ...e,
          metadata: e.metadata ? JSON.stringify(e.metadata) : null
        }))
      })
    } catch (error) {
      console.error('Failed to write audit logs:', error)
      // 失败时可以考虑写入文件或重试队列
    }
  }
  
  dispose(): void {
    clearInterval(this.flushInterval)
    this.flush()
  }
}

export const auditService = new AuditService()
```

### 8.2 HTTP 层集成

```typescript
// src/http/middleware/audit.ts

import { Elysia } from 'elysia'
import { auditService } from '../../services/audit'

export const auditMiddleware = new Elysia({ name: 'audit' })
  .onAfterHandle(async ({ request, user, path, params }) => {
    const sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
    
    if (sensitiveMethods.includes(request.method)) {
      auditService.log({
        userId: user?.id,
        action: request.method,
        resource: path,
        resourceId: params?.id,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true,
        metadata: { params: params ? JSON.stringify(params) : undefined }
      })
    }
  })
  .onError(async ({ request, user, path, params, error }) => {
    auditService.log({
      userId: user?.id,
      action: request.method,
      resource: path,
      resourceId: params?.id,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: false,
      error: error.message,
      metadata: { params: params ? JSON.stringify(params) : undefined }
    })
  })
```

---

## 总结

优化后的 RBAC 系统解决了原设计的以下问题：

| 原问题 | 优化方案 |
|-------|---------|
| 单角色限制 | 多对多关系支持多角色 |
| 角色继承未实现 | `getRoleWithInheritance` 递归获取所有权限 |
| 内存缓存不支持分布式 | Redis 实现支持多实例 |
| 所有权检查硬编码 | 数据库配置 `OwnershipPolicy` 表 |
| 审计日志同步写入 | 异步批量写入，不阻塞请求 |
| 权限与 HTTP 层耦合 | 独立的 `PermissionService` 服务层 |
| 缺少数据范围控制 | 新增 `ScopePolicy` 和 `UserScope` |
| 守卫和宏重复 | 统一使用宏，移除守卫中间件 |
