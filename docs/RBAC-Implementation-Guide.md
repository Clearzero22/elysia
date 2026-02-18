# Elysia 框架 RBAC 权限控制系统实现指南

## 目录

1. [项目概述](#1-项目概述)
2. [RBAC 核心概念](#2-rbac-核心概念)
3. [系统架构设计](#3-系统架构设计)
4. [数据库模型设计](#4-数据库模型设计)
5. [核心模块实现](#5-核心模块实现)
6. [中间件与守卫](#6-中间件与守卫)
7. [使用示例](#7-使用示例)
8. [高级功能](#8-高级功能)
9. [最佳实践](#9-最佳实践)
10. [性能优化](#10-性能优化)

---

## 1. 项目概述

### 1.1 什么是 RBAC

RBAC（Role-Based Access Control，基于角色的访问控制）是一种广泛使用的访问控制机制，通过将权限与角色关联，再将角色分配给用户，实现对系统资源的精细控制。

### 1.2 技术栈

- **框架**: Elysia.js (Bun 运行时)
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: JWT + @elysiajs/jwt
- **类型安全**: TypeScript 端到端类型安全

### 1.3 特性亮点

- ✅ 声明式权限控制
- ✅ 完全类型安全
- ✅ 支持角色继承
- ✅ 资源所有权检查
- ✅ 动态权限分配
- ✅ 高性能缓存策略

---

## 2. RBAC 核心概念

### 2.1 核心实体关系

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────<│    Role     │>────│ Permission  │
│   (用户)     │ N:1 │   (角色)     │ M:N │   (权限)     │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 2.2 权限模型

采用 **Resource-Action** 模型：

| 资源(Resource) | 操作(Action) | 组合权限 |
|---------------|-------------|---------|
| project | create | project:create |
| project | read | project:read |
| project | update | project:update |
| project | delete | project:delete |
| task | create | task:create |
| user | manage | user:manage |

---

## 3. 系统架构设计

### 3.1 模块架构

```
src/
├── modules/
│   └── rbac/               # RBAC 核心模块
│       ├── index.ts        # 核心权限检查逻辑
│       ├── macros.ts       # Elysia 宏定义
│       ├── cache.ts        # 权限缓存
│       └── types.ts        # 类型定义
├── middleware/
│   ├── auth.ts             # 认证中间件
│   ├── guard.ts            # 权限守卫
│   └── ownership.ts        # 所有权检查
├── decorators/             # 装饰器（如果使用）
└── db/
    └── prisma.ts           # 数据库连接
```

### 3.2 请求处理流程

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│ Request │───>│   CORS   │───>│  Logger  │───>│   Auth   │───>│  RBAC   │
└─────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬────┘
                                                                     │
              ┌─────────┐    ┌──────────┐    ┌──────────┐           │
              │ Response│<───│ Handler  │<───│  Guard   │<──────────┘
              └─────────┘    └──────────┘    └──────────┘
```

---

## 4. 数据库模型设计

### 4.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户表
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String   // 加密存储
  
  // RBAC 关联
  roleId    String?
  role      Role?    @relation(fields: [roleId], references: [id])
  
  // 资源所有权
  ownedProjects Project[] @relation("ProjectOwner")
  createdTasks  Task[]    @relation("TaskCreator")
  assignedTasks Task[]    @relation("TaskAssignee")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

// 角色表
model Role {
  id          String       @id @default(uuid())
  name        String       @unique
  description String?
  
  // 关联
  permissions Permission[]
  users       User[]
  
  // 角色继承（可选高级功能）
  parentId    String?
  parent      Role?        @relation("RoleHierarchy", fields: [parentId], references: [id])
  children    Role[]       @relation("RoleHierarchy")
  
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@map("roles")
}

// 权限表
model Permission {
  id          String   @id @default(uuid())
  resource    String   // 资源类型: project, task, user, etc.
  action      String   // 操作类型: create, read, update, delete, manage
  description String?
  
  // 关联
  roles       Role[]
  
  createdAt   DateTime @default(now())

  @@unique([resource, action])
  @@map("permissions")
}

// 项目表
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  
  // 所有权
  ownerId     String
  owner       User     @relation("ProjectOwner", fields: [ownerId], references: [id])
  
  // 关联
  tasks       Task[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("projects")
}

// 任务表
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

### 4.2 数据库迁移

```bash
# 生成迁移文件
npx prisma migrate dev --name init_rbac

# 生成客户端
npx prisma generate

# 数据库种子
npx prisma db seed
```

---

## 5. 核心模块实现

### 5.1 类型定义

```typescript
// src/modules/rbac/types.ts

// 基础权限检查类型
export interface PermissionCheck {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
}

// 权限字符串格式: "resource:action"
export type PermissionString = `${string}:${string}`

// RBAC 上下文
export interface RBACContext {
  userId: string
  roleId?: string
  permissions: PermissionCheck[]
}

// 守卫选项
export interface GuardOptions {
  permissions?: PermissionCheck[]
  roles?: string[]
  ownership?: boolean
  resourceType?: 'project' | 'task'
}

// 缓存条目
export interface CacheEntry<T> {
  data: T
  expiresAt: number
}
```

### 5.2 RBAC 核心模块

```typescript
// src/modules/rbac/index.ts
import { Elysia } from 'elysia'
import { db } from '../../db/prisma'
import { PermissionCache } from './cache'
import type { PermissionCheck, RBACContext } from './types'

// 权限缓存实例（5分钟过期）
const permissionCache = new PermissionCache<string[]>(5 * 60 * 1000)

export const rbac = new Elysia({ name: 'rbac' })
  // 注入权限检查方法
  .decorate('rbac', {
    
    /**
     * 检查用户是否拥有指定权限
     */
    async hasPermission(
      userId: string, 
      check: PermissionCheck
    ): Promise<boolean> {
      // 1. 检查缓存
      const cacheKey = `perms:${userId}`
      let permissions = permissionCache.get(cacheKey)
      
      // 2. 缓存未命中，查询数据库
      if (!permissions) {
        const user = await db.user.findUnique({
          where: { id: userId },
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        })
        
        if (!user?.role) {
          return false
        }
        
        // 转换权限为字符串数组
        permissions = user.role.permissions.map(
          p => `${p.resource}:${p.action}`
        )
        
        // 存入缓存
        permissionCache.set(cacheKey, permissions)
      }
      
      // 3. 检查权限
      const required = `${check.resource}:${check.action}`
      return permissions.includes(required) || 
             permissions.includes(`${check.resource}:manage`) // manage 通配
    },

    /**
     * 检查用户是否拥有多个权限（AND 关系）
     */
    async hasAllPermissions(
      userId: string, 
      checks: PermissionCheck[]
    ): Promise<boolean> {
      const results = await Promise.all(
        checks.map(check => this.hasPermission(userId, check))
      )
      return results.every(Boolean)
    },

    /**
     * 检查用户是否拥有任一权限（OR 关系）
     */
    async hasAnyPermission(
      userId: string, 
      checks: PermissionCheck[]
    ): Promise<boolean> {
      const results = await Promise.all(
        checks.map(check => this.hasPermission(userId, check))
      )
      return results.some(Boolean)
    },

    /**
     * 检查用户角色
     */
    async hasRole(userId: string, roleName: string): Promise<boolean> {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { role: true }
      })
      return user?.role?.name === roleName
    },

    /**
     * 检查用户是否拥有任一角色
     */
    async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { role: true }
      })
      return user?.role ? roleNames.includes(user.role.name) : false
    },

    /**
     * 获取用户完整 RBAC 上下文
     */
    async getContext(userId: string): Promise<RBACContext | null> {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })

      if (!user) return null

      return {
        userId: user.id,
        roleId: user.roleId || undefined,
        permissions: user.role?.permissions.map(p => ({
          resource: p.resource,
          action: p.action as PermissionCheck['action']
        })) || []
      }
    },

    /**
     * 清除用户权限缓存
     */
    invalidateCache(userId: string): void {
      permissionCache.delete(`perms:${userId}`)
    }
  })
  .as('plugin')

// 类型导出
export type RBACPlugin = typeof rbac
```

### 5.3 权限缓存实现

```typescript
// src/modules/rbac/cache.ts

export class PermissionCache<T> {
  private cache = new Map<string, { data: T; expires: number }>()
  private defaultTTL: number

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL
    this.startCleanup()
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return undefined
    }
    
    return entry.data
  }

  set(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.defaultTTL)
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // 定期清理过期缓存
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expires) {
          this.cache.delete(key)
        }
      }
    }, 60 * 1000) // 每分钟清理一次
  }
}
```

---

## 6. 中间件与守卫

### 6.1 认证中间件

```typescript
// src/middleware/auth.ts
import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { db } from '../db/prisma'

// JWT Payload 类型
interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

export const authMiddleware = new Elysia({ name: 'auth' })
  .use(bearer())
  .use(jwt({
    secret: process.env.JWT_SECRET!,
    exp: '7d' // 7天过期
  }))
  .derive(async ({ jwt, bearer, set, request }): Promise<{
    user?: {
      id: string
      email: string
      name: string
      roleId?: string
    }
    isAuthenticated: boolean
  }> => {
    // 公开路径跳过认证
    const publicPaths = ['/auth/login', '/auth/register', '/docs']
    if (publicPaths.some(path => request.url.includes(path))) {
      return { isAuthenticated: false }
    }

    if (!bearer) {
      set.status = 401
      return { isAuthenticated: false }
    }

    try {
      const payload = await jwt.verify(bearer) as JWTPayload
      
      if (!payload?.userId) {
        set.status = 401
        return { isAuthenticated: false }
      }

      // 获取用户信息
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, roleId: true }
      })

      if (!user) {
        set.status = 401
        return { isAuthenticated: false }
      }

      return {
        user,
        isAuthenticated: true
      }
    } catch (error) {
      set.status = 401
      return { isAuthenticated: false }
    }
  })
  .onBeforeHandle(({ isAuthenticated, set }) => {
    if (!isAuthenticated && set.status === 401) {
      return {
        code: 401,
        message: '未提供有效的认证令牌'
      }
    }
  })
```

### 6.2 权限守卫中间件

```typescript
// src/middleware/guard.ts
import { Elysia, error } from 'elysia'
import { rbac } from '../modules/rbac'
import type { PermissionCheck } from '../modules/rbac/types'

/**
 * 要求特定权限
 */
export const requirePermission = (resource: string, action: string) => 
  new Elysia({ name: `guard:perm:${resource}:${action}` })
    .use(rbac)
    .onBeforeHandle(async ({ user, rbac, error }) => {
      if (!user) {
        return error(401, { code: 401, message: '未登录' })
      }

      const hasPermission = await rbac.hasPermission(user.id, { resource, action })
      
      if (!hasPermission) {
        return error(403, {
          code: 403,
          message: `需要 ${resource}:${action} 权限`
        })
      }
    })

/**
 * 要求多个权限（AND）
 */
export const requireAllPermissions = (...checks: PermissionCheck[]) =>
  new Elysia({ name: 'guard:perm:all' })
    .use(rbac)
    .onBeforeHandle(async ({ user, rbac, error }) => {
      if (!user) {
        return error(401, { code: 401, message: '未登录' })
      }

      const hasAll = await rbac.hasAllPermissions(user.id, checks)
      
      if (!hasAll) {
        const perms = checks.map(c => `${c.resource}:${c.action}`).join(', ')
        return error(403, {
          code: 403,
          message: `需要以下所有权限: ${perms}`
        })
      }
    })

/**
 * 要求任一权限（OR）
 */
export const requireAnyPermission = (...checks: PermissionCheck[]) =>
  new Elysia({ name: 'guard:perm:any' })
    .use(rbac)
    .onBeforeHandle(async ({ user, rbac, error }) => {
      if (!user) {
        return error(401, { code: 401, message: '未登录' })
      }

      const hasAny = await rbac.hasAnyPermission(user.id, checks)
      
      if (!hasAny) {
        const perms = checks.map(c => `${c.resource}:${c.action}`).join(' 或 ')
        return error(403, {
          code: 403,
          message: `需要以下任一权限: ${perms}`
        })
      }
    })

/**
 * 要求特定角色
 */
export const requireRole = (...roleNames: string[]) =>
  new Elysia({ name: `guard:role:${roleNames.join(',')}` })
    .use(rbac)
    .onBeforeHandle(async ({ user, rbac, error }) => {
      if (!user) {
        return error(401, { code: 401, message: '未登录' })
      }

      const hasRole = await rbac.hasAnyRole(user.id, roleNames)
      
      if (!hasRole) {
        return error(403, {
          code: 403,
          message: `需要以下角色之一: ${roleNames.join(', ')}`
        })
      }
    })

/**
 * 管理员跳过检查
 */
export const skipIfAdmin = () =>
  new Elysia({ name: 'guard:admin:skip' })
    .use(rbac)
    .derive(async ({ user, rbac }): Promise<{ isAdmin: boolean }> => {
      if (!user) return { isAdmin: false }
      const isAdmin = await rbac.hasRole(user.id, 'admin')
      return { isAdmin }
    })
```

### 6.3 资源所有权检查

```typescript
// src/middleware/ownership.ts
import { Elysia, error } from 'elysia'
import { rbac } from '../modules/rbac'
import { db } from '../db/prisma'

/**
 * 项目所有权检查
 */
export const projectOwnership = new Elysia({ name: 'ownership:project' })
  .use(rbac)
  .onBeforeHandle(async ({ user, params, rbac, error }) => {
    if (!user) {
      return error(401, { code: 401, message: '未登录' })
    }

    // 管理员自动通过
    const isAdmin = await rbac.hasRole(user.id, 'admin')
    if (isAdmin) return

    // 获取项目
    const project = await db.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true }
    })

    if (!project) {
      return error(404, { code: 404, message: '项目不存在' })
    }

    // 检查所有权
    if (project.ownerId !== user.id) {
      return error(403, { 
        code: 403, 
        message: '只能操作自己创建的项目' 
      })
    }
  })

/**
 * 任务所有权/参与权检查
 */
export const taskAccess = new Elysia({ name: 'ownership:task' })
  .use(rbac)
  .onBeforeHandle(async ({ user, params, rbac, error }) => {
    if (!user) {
      return error(401, { code: 401, message: '未登录' })
    }

    // 管理员自动通过
    const isAdmin = await rbac.hasRole(user.id, 'admin')
    if (isAdmin) return

    // 获取任务
    const task = await db.task.findUnique({
      where: { id: params.id },
      include: { 
        project: { select: { ownerId: true } }
      }
    })

    if (!task) {
      return error(404, { code: 404, message: '任务不存在' })
    }

    // 检查是否是：项目所有者、任务创建者、任务分配者
    const hasAccess = 
      task.project.ownerId === user.id ||
      task.creatorId === user.id ||
      task.assigneeId === user.id

    if (!hasAccess) {
      return error(403, { 
        code: 403, 
        message: '只能访问相关项目的任务' 
      })
    }
  })

/**
 * 组合守卫：权限或所有权
 */
export const requirePermissionOrOwnership = (
  resource: string, 
  action: string,
  resourceType: 'project' | 'task'
) => new Elysia({ name: `guard:${resource}:${action}:or:owner` })
  .use(rbac)
  .onBeforeHandle(async ({ user, params, rbac, error }) => {
    if (!user) {
      return error(401, { code: 401, message: '未登录' })
    }

    // 先检查权限
    const hasPermission = await rbac.hasPermission(user.id, { resource, action })
    if (hasPermission) return

    // 再检查所有权
    const model = resourceType === 'project' 
      ? db.project 
      : db.task

    const item = await (model as any).findUnique({
      where: { id: params.id },
      include: resourceType === 'task' 
        ? { project: { select: { ownerId: true } } }
        : undefined
    })

    if (!item) {
      return error(404, { code: 404, message: '资源不存在' })
    }

    const ownerId = resourceType === 'project' 
      ? item.ownerId 
      : item.project?.ownerId || item.creatorId

    if (ownerId !== user.id) {
      return error(403, {
        code: 403,
        message: `需要 ${resource}:${action} 权限或是资源所有者`
      })
    }
  })
```

### 6.4 Elysia 宏定义（声明式权限）

```typescript
// src/modules/rbac/macros.ts
import { Elysia } from 'elysia'
import { rbac } from './index'
import { db } from '../../db/prisma'

/**
 * RBAC 宏定义 - 提供更简洁的声明式语法
 */
export const rbacMacros = new Elysia({ name: 'rbac:macros' })
  .use(rbac)
  .macro(({ onBeforeHandle }) => ({
    /**
     * 单个权限检查
     * 使用: permission: ['project', 'create']
     */
    permission(resource: string, action: string) {
      onBeforeHandle(async function* ({ user, rbac, error }) {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }

        const has = await rbac.hasPermission(user.id, { resource, action })
        if (!has) {
          return error(403, {
            code: 403,
            message: `需要 ${resource}:${action} 权限`
          })
        }
      })
    },

    /**
     * 多个权限检查（AND）
     * 使用: allPermissions: [['project', 'create'], ['task', 'create']]
     */
    allPermissions(checks: [string, string][]) {
      onBeforeHandle(async function* ({ user, rbac, error }) {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }

        const hasAll = await rbac.hasAllPermissions(
          user.id,
          checks.map(([r, a]) => ({ resource: r, action: a as any }))
        )
        
        if (!hasAll) {
          const perms = checks.map(c => c.join(':')).join(', ')
          return error(403, {
            code: 403,
            message: `需要以下所有权限: ${perms}`
          })
        }
      })
    },

    /**
     * 角色检查
     * 使用: role: 'admin'
     */
    role(...roles: string[]) {
      onBeforeHandle(async function* ({ user, rbac, error }) {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }

        const hasRole = await rbac.hasAnyRole(user.id, roles)
        if (!hasRole) {
          return error(403, {
            code: 403,
            message: `需要以下角色之一: ${roles.join(', ')}`
          })
        }
      })
    },

    /**
     * 资源所有权检查
     * 使用: ownership: 'project'
     */
    ownership(resourceType: 'project' | 'task') {
      onBeforeHandle(async function* ({ user, params, rbac, error }) {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }

        // 管理员跳过
        const isAdmin = await rbac.hasRole(user.id, 'admin')
        if (isAdmin) return

        const model = db[resourceType]
        const resource = await (model as any).findUnique({
          where: { id: params.id },
          include: resourceType === 'task' 
            ? { project: { select: { ownerId: true } } }
            : undefined
        })

        if (!resource) {
          return error(404, { code: 404, message: '资源不存在' })
        }

        const ownerId = resourceType === 'project'
          ? resource.ownerId
          : resource.project?.ownerId || resource.creatorId

        if (ownerId !== user.id) {
          return error(403, {
            code: 403,
            message: '只能操作自己的资源'
          })
        }
      })
    },

    /**
     * 权限或所有权
     * 使用: permissionOrOwnership: [['project', 'update'], 'project']
     */
    permissionOrOwnership([
      [resource, action],
      resourceType
    ]: [[string, string], 'project' | 'task']) {
      onBeforeHandle(async function* ({ user, params, rbac, error }) {
        if (!user) {
          return error(401, { code: 401, message: '未登录' })
        }

        // 先检查权限
        const hasPerm = await rbac.hasPermission(user.id, { resource, action })
        if (hasPerm) return

        // 检查所有权
        const model = db[resourceType]
        const item = await (model as any).findUnique({
          where: { id: params.id },
          include: resourceType === 'task'
            ? { project: { select: { ownerId: true } } }
            : undefined
        })

        if (!item) {
          return error(404, { code: 404, message: '资源不存在' })
        }

        const ownerId = resourceType === 'project'
          ? item.ownerId
          : item.project?.ownerId || item.creatorId

        if (ownerId !== user.id) {
          return error(403, {
            code: 403,
            message: `需要 ${resource}:${action} 权限或是资源所有者`
          })
        }
      })
    }
  }))
```

---

## 7. 使用示例

### 7.1 基础路由权限控制

```typescript
// src/modules/projects/index.ts
import { Elysia, t } from 'elysia'
import { rbacMacros } from '../rbac/macros'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission } from '../../middleware/guard'
import { projectOwnership } from '../../middleware/ownership'
import { db } from '../../db/prisma'

export const projectModule = new Elysia({ prefix: '/projects' })
  .use(authMiddleware)
  
  // ============ 列表和创建（需要权限） ============
  
  // 获取所有项目 - 需要 project:read 权限
  .get('/', async ({ user, rbac }) => {
    // 管理员看所有，普通用户看自己的
    const isAdmin = await rbac.hasRole(user!.id, 'admin')
    
    const projects = isAdmin
      ? await db.project.findMany({
          include: { owner: { select: { id: true, name: true, email: true } } }
        })
      : await db.project.findMany({
          where: { ownerId: user!.id },
          include: { owner: { select: { id: true, name: true, email: true } } }
        })
    
    return { projects }
  }, {
    // 使用守卫中间件
    beforeHandle: [
      async ({ user, error }) => {
        if (!user) return error(401, '未登录')
      }
    ]
  })
  
  // 创建项目 - 需要 project:create 权限
  .post('/', async ({ body, user }) => {
    const project = await db.project.create({
      data: {
        ...body,
        ownerId: user!.id
      },
      include: { owner: { select: { id: true, name: true, email: true } } }
    })
    return { project }
  }, {
    use: [requirePermission('project', 'create')],
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 500 }))
    })
  })
  
  // ============ 单个项目操作（权限或所有权） ============
  
  // 获取项目详情 - 需要权限或是成员
  .get('/:id', async ({ params }) => {
    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tasks: {
          select: { id: true, title: true, status: true, priority: true }
        }
      }
    })
    
    if (!project) {
      return { code: 404, message: '项目不存在' }
    }
    
    return { project }
  }, {
    use: [requirePermission('project', 'read')]
  })
  
  // 更新项目 - 需要权限或是所有者
  .put('/:id', async ({ params, body }) => {
    const project = await db.project.update({
      where: { id: params.id },
      data: body
    })
    return { project }
  }, {
    use: [requirePermission('project', 'update'), projectOwnership],
    params: t.Object({ id: t.String() }),
    body: t.Partial(t.Object({
      name: t.String({ minLength: 1 }),
      description: t.String(),
      status: t.Union([
        t.Literal('ACTIVE'),
        t.Literal('ARCHIVED')
      ])
    }))
  })
  
  // 删除项目 - 仅管理员或所有者
  .delete('/:id', async ({ params }) => {
    await db.project.delete({ where: { id: params.id } })
    return { message: '删除成功' }
  }, {
    use: [requirePermission('project', 'delete'), projectOwnership]
  })
```

### 7.2 使用宏的简洁写法

```typescript
// src/modules/projects/index-v2.ts
import { Elysia, t } from 'elysia'
import { rbacMacros } from '../rbac/macros'
import { authMiddleware } from '../../middleware/auth'

export const projectModuleV2 = new Elysia({ prefix: '/projects-v2' })
  .use(authMiddleware)
  .use(rbacMacros)
  
  // 使用宏定义权限 - 简洁声明式
  
  // 角色级别的控制
  .get('/admin/all', async () => {
    const projects = await db.project.findMany({
      include: { owner: true, tasks: true }
    })
    return { projects }
  }, {
    role: ['admin']  // 仅管理员
  })
  
  // 权限控制
  .post('/', async ({ body, user }) => {
    const project = await db.project.create({
      data: { ...body, ownerId: user!.id }
    })
    return { project }
  }, {
    permission: ['project', 'create']
  })
  
  // 所有权控制
  .put('/:id', async ({ params, body }) => {
    const project = await db.project.update({
      where: { id: params.id },
      data: body
    })
    return { project }
  }, {
    permissionOrOwnership: [['project', 'update'], 'project']
  })
  
  // 删除需要高级权限
  .delete('/:id', async ({ params }) => {
    await db.project.delete({ where: { id: params.id } })
    return { message: '删除成功' }
  }, {
    allPermissions: [['project', 'delete'], ['project', 'manage']],
    ownership: 'project'  // 或所有者
  })
```

### 7.3 任务模块（更复杂的权限场景）

```typescript
// src/modules/tasks/index.ts
import { Elysia, t } from 'elysia'
import { rbacMacros } from '../rbac/macros'
import { authMiddleware } from '../../middleware/auth'
import { taskAccess } from '../../middleware/ownership'
import { db } from '../../db/prisma'

export const taskModule = new Elysia({ prefix: '/tasks' })
  .use(authMiddleware)
  .use(rbacMacros)
  
  // 获取任务列表 - 多种权限场景
  .get('/', async ({ query, user, rbac }) => {
    const { projectId, status, assignedToMe } = query
    
    const where: any = {}
    
    // 项目过滤
    if (projectId) {
      where.projectId = projectId
    }
    
    // 状态过滤
    if (status) {
      where.status = status
    }
    
    // 分配给我
    if (assignedToMe === 'true') {
      where.assigneeId = user!.id
    }
    
    // 权限过滤
    const isAdmin = await rbac.hasRole(user!.id, 'admin')
    const canReadAll = await rbac.hasPermission(user!.id, { 
      resource: 'task', 
      action: 'read' 
    })
    
    // 普通用户只能看相关的任务
    if (!isAdmin && !canReadAll) {
      where.OR = [
        { creatorId: user!.id },
        { assigneeId: user!.id },
        { project: { ownerId: user!.id } }
      ]
    }
    
    const tasks = await db.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      }
    })
    
    return { tasks }
  }, {
    query: t.Object({
      projectId: t.Optional(t.String()),
      status: t.Optional(t.Union([
        t.Literal('TODO'),
        t.Literal('IN_PROGRESS'),
        t.Literal('REVIEW'),
        t.Literal('DONE')
      ])),
      assignedToMe: t.Optional(t.String())
    })
  })
  
  // 创建任务 - 需要权限或是项目成员
  .post('/', async ({ body, user }) => {
    // 检查用户是否是项目成员
    const project = await db.project.findUnique({
      where: { id: body.projectId }
    })
    
    if (!project) {
      return { code: 404, message: '项目不存在' }
    }
    
    const task = await db.task.create({
      data: {
        ...body,
        creatorId: user!.id
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      }
    })
    
    return { task }
  }, {
    permission: ['task', 'create'],
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 200 }),
      description: t.Optional(t.String()),
      projectId: t.String(),
      assigneeId: t.Optional(t.String()),
      priority: t.Optional(t.Union([
        t.Literal('LOW'),
        t.Literal('MEDIUM'),
        t.Literal('HIGH'),
        t.Literal('URGENT')
      ]))
    })
  })
  
  // 更新任务 - 复杂权限：管理员、任务创建者、任务执行者、项目所有者
  .put('/:id', async ({ params, body, user, rbac }) => {
    const existingTask = await db.task.findUnique({
      where: { id: params.id },
      include: { project: true }
    })
    
    if (!existingTask) {
      return { code: 404, message: '任务不存在' }
    }
    
    // 权限检查
    const isAdmin = await rbac.hasRole(user!.id, 'admin')
    const hasUpdatePerm = await rbac.hasPermission(user!.id, {
      resource: 'task',
      action: 'update'
    })
    
    const canUpdate = isAdmin || 
                      hasUpdatePerm ||
                      existingTask.creatorId === user!.id ||
                      existingTask.assigneeId === user!.id ||
                      existingTask.project.ownerId === user!.id
    
    if (!canUpdate) {
      return { code: 403, message: '无权限更新此任务' }
    }
    
    // 普通成员只能更新状态和进度
    const canEditAll = isAdmin || hasUpdatePerm || existingTask.creatorId === user!.id
    const updateData = canEditAll ? body : { status: body.status }
    
    const task = await db.task.update({
      where: { id: params.id },
      data: updateData
    })
    
    return { task }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Partial(t.Object({
      title: t.String(),
      description: t.String(),
      status: t.Union([
        t.Literal('TODO'),
        t.Literal('IN_PROGRESS'),
        t.Literal('REVIEW'),
        t.Literal('DONE')
      ]),
      priority: t.Union([
        t.Literal('LOW'),
        t.Literal('MEDIUM'),
        t.Literal('HIGH'),
        t.Literal('URGENT')
      ]),
      assigneeId: t.String()
    }))
  })
  
  // 删除任务 - 需要 task:delete 或 task:manage 权限
  .delete('/:id', async ({ params }) => {
    await db.task.delete({ where: { id: params.id } })
    return { message: '删除成功' }
  }, {
    anyPermissions: [
      ['task', 'delete'],
      ['task', 'manage']
    ],
    use: [taskAccess]
  })
```

---

## 8. 高级功能

### 8.1 动态权限管理 API

```typescript
// src/modules/rbac/admin.ts
import { Elysia, t } from 'elysia'
import { requireRole } from '../../middleware/guard'
import { db } from '../../db/prisma'

export const rbacAdminModule = new Elysia({ prefix: '/admin/rbac' })
  .use(requireRole('admin'))
  
  // ========== 角色管理 ==========
  
  // 获取所有角色
  .get('/roles', async () => {
    const roles = await db.role.findMany({
      include: { permissions: true }
    })
    return { roles }
  })
  
  // 创建角色
  .post('/roles', async ({ body }) => {
    const role = await db.role.create({
      data: {
        name: body.name,
        description: body.description,
        permissions: {
          connect: body.permissionIds?.map(id => ({ id }))
        }
      },
      include: { permissions: true }
    })
    return { role }
  }, {
    body: t.Object({
      name: t.String(),
      description: t.Optional(t.String()),
      permissionIds: t.Optional(t.Array(t.String()))
    })
  })
  
  // 更新角色权限
  .put('/roles/:id/permissions', async ({ params, body }) => {
    const role = await db.role.update({
      where: { id: params.id },
      data: {
        permissions: {
          set: body.permissionIds.map(id => ({ id }))
        }
      },
      include: { permissions: true }
    })
    return { role }
  }, {
    body: t.Object({
      permissionIds: t.Array(t.String())
    })
  })
  
  // ========== 权限管理 ==========
  
  // 获取所有权限
  .get('/permissions', async () => {
    const permissions = await db.permission.findMany()
    return { permissions }
  })
  
  // 创建权限
  .post('/permissions', async ({ body }) => {
    const permission = await db.permission.create({
      data: body
    })
    return { permission }
  }, {
    body: t.Object({
      resource: t.String(),
      action: t.String(),
      description: t.Optional(t.String())
    })
  })
  
  // ========== 用户角色分配 ==========
  
  // 给用户分配角色
  .put('/users/:userId/role', async ({ params, body, rbac }) => {
    const user = await db.user.update({
      where: { id: params.userId },
      data: { roleId: body.roleId },
      include: { role: { include: { permissions: true } } }
    })
    
    // 清除用户权限缓存
    rbac.invalidateCache(params.userId)
    
    return { user }
  }, {
    body: t.Object({
      roleId: t.String()
    })
  })
  
  // 获取用户权限详情
  .get('/users/:userId/permissions', async ({ params, rbac }) => {
    const context = await rbac.getContext(params.userId)
    return { context }
  })
```

### 8.2 权限审计日志

```typescript
// src/modules/audit/index.ts
import { Elysia } from 'elysia'
import { db } from '../../db/prisma'

// 审计日志中间件
export const auditLog = new Elysia({ name: 'audit' })
  .onAfterHandle(async ({ request, user, path, store }) => {
    // 记录敏感操作
    const sensitiveMethods = ['POST', 'PUT', 'DELETE']
    
    if (sensitiveMethods.includes(request.method)) {
      await db.auditLog.create({
        data: {
          userId: user?.id,
          action: request.method,
          resource: path,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          success: true
        }
      })
    }
  })
  .onError(async ({ request, user, path, error }) => {
    await db.auditLog.create({
      data: {
        userId: user?.id,
        action: request.method,
        resource: path,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: false,
        error: error.message
      }
    })
  })

// 审计日志模型（添加到 schema）
/*
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  resource  String
  ip        String
  userAgent String
  success   Boolean
  error     String?
  createdAt DateTime @default(now())
}
*/
```

---

## 9. 最佳实践

### 9.1 权限命名规范

```typescript
// 资源命名
const RESOURCES = {
  PROJECT: 'project',
  TASK: 'task',
  USER: 'user',
  TEAM: 'team',
  REPORT: 'report',
  SETTINGS: 'settings'
} as const

// 操作命名
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',  // 通配权限
  EXPORT: 'export',
  INVITE: 'invite'
} as const

// 使用
permission: [`${RESOURCES.PROJECT}`, `${ACTIONS.CREATE}`]
```

### 9.2 预定义角色模板

```typescript
// src/modules/rbac/roles.ts

export const ROLE_TEMPLATES = {
  admin: {
    name: 'admin',
    description: '超级管理员',
    permissions: ['*:*'] // 通配所有权限
  },
  
  manager: {
    name: 'manager',
    description: '项目经理',
    permissions: [
      'project:create', 'project:read', 'project:update', 'project:delete',
      'task:create', 'task:read', 'task:update', 'task:delete',
      'team:manage', 'report:read'
    ]
  },
  
  member: {
    name: 'member',
    description: '普通成员',
    permissions: [
      'project:read',
      'task:create', 'task:read', 'task:update'
    ]
  },
  
  viewer: {
    name: 'viewer',
    description: '访客/只读',
    permissions: [
      'project:read',
      'task:read'
    ]
  }
}
```

### 9.3 错误处理统一化

```typescript
// src/utils/errors.ts

export class PermissionDeniedError extends Error {
  code = 403
  constructor(permission: string) {
    super(`需要权限: ${permission}`)
  }
}

export class OwnershipError extends Error {
  code = 403
  constructor() {
    super('只能操作自己的资源')
  }
}

// 全局错误处理
export const errorHandler = new Elysia()
  .onError(({ code, error, set }) => {
    if (error instanceof PermissionDeniedError) {
      set.status = 403
      return {
        code: 403,
        message: error.message,
        type: 'PERMISSION_DENIED'
      }
    }
    
    if (error instanceof OwnershipError) {
      set.status = 403
      return {
        code: 403,
        message: error.message,
        type: 'OWNERSHIP_REQUIRED'
      }
    }
    
    // 其他错误...
  })
```

---

## 10. 性能优化

### 10.1 缓存策略

```typescript
// 多级缓存策略
class PermissionCache {
  // L1: 内存缓存（5分钟）
  private memoryCache = new Map<string, CacheEntry>()
  
  // L2: Redis 缓存（15分钟）
  private redisCache?: Redis
  
  async get(userId: string): Promise<string[] | null> {
    const key = `perms:${userId}`
    
    // L1 检查
    const mem = this.memoryCache.get(key)
    if (mem && mem.expires > Date.now()) {
      return mem.data
    }
    
    // L2 检查
    if (this.redisCache) {
      const redis = await this.redisCache.get(key)
      if (redis) {
        const data = JSON.parse(redis)
        this.memoryCache.set(key, { data, expires: Date.now() + 5 * 60 * 1000 })
        return data
      }
    }
    
    return null
  }
  
  async set(userId: string, permissions: string[]): Promise<void> {
    const key = `perms:${userId}`
    
    // L1
    this.memoryCache.set(key, {
      data: permissions,
      expires: Date.now() + 5 * 60 * 1000
    })
    
    // L2
    if (this.redisCache) {
      await this.redisCache.setex(key, 15 * 60, JSON.stringify(permissions))
    }
  }
  
  // 批量清除
  async invalidate(userIds: string[]): Promise<void> {
    for (const id of userIds) {
      this.memoryCache.delete(`perms:${id}`)
      if (this.redisCache) {
        await this.redisCache.del(`perms:${id}`)
      }
    }
  }
}
```

### 10.2 数据库查询优化

```typescript
// 使用批量查询减少数据库往返
async function checkPermissionsBatch(
  userIds: string[],
  checks: PermissionCheck[]
): Promise<Map<string, boolean>> {
  // 单次查询获取所有用户的权限
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    include: {
      role: {
        include: { permissions: true }
      }
    }
  })
  
  const results = new Map<string, boolean>()
  
  for (const user of users) {
    const permissions = new Set(
      user.role?.permissions.map(p => `${p.resource}:${p.action}`) || []
    )
    
    const hasAll = checks.every(
      c => permissions.has(`${c.resource}:${c.action}`) ||
           permissions.has(`${c.resource}:manage`)
    )
    
    results.set(user.id, hasAll)
  }
  
  return results
}
```

---

## 11. 测试示例

```typescript
// tests/rbac.test.ts
import { describe, it, expect, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'
import { rbac } from '../src/modules/rbac'

describe('RBAC', () => {
  const app = new Elysia().use(rbac)
  
  it('should check permission correctly', async () => {
    // 测试权限检查逻辑
  })
  
  it('should cache permissions', async () => {
    // 测试缓存机制
  })
  
  it('should deny access without permission', async () => {
    const response = await app.handle(
      new Request('http://localhost/projects', { method: 'POST' })
    )
    expect(response.status).toBe(403)
  })
})
```

---

## 总结

这份指南提供了一个完整的 RBAC 实现方案，涵盖了：

1. **数据库设计** - 用户-角色-权限三表模型
2. **核心模块** - 权限检查、角色验证、缓存机制
3. **中间件系统** - 守卫、所有权检查、宏定义
4. **使用示例** - 项目和任务模块的权限控制
5. **高级功能** - 动态权限管理、审计日志
6. **性能优化** - 多级缓存、批量查询

这套 RBAC 系统具有高度的灵活性和扩展性，可根据项目需求进行调整。
