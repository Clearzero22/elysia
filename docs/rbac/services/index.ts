// src/services/rbac/index.ts

import type { PermissionCache } from './types'
import { createPermissionCache } from './cache'
import {
  getPermissionService,
  initializePermissionService,
  PermissionService
} from './permission-service'
import {
  getOwnershipService,
  initializeOwnershipService,
  OwnershipService
} from './ownership-service'
import {
  getScopeResolver,
  initializeScopeResolver,
  ScopeResolver
} from './scope-resolver'

export * from './types'
export * from './cache'
export * from './scope-helpers'
export * from './authorization-checker'
export { PermissionService } from './permission-service'
export { OwnershipService } from './ownership-service'
export { ScopeResolver } from './scope-resolver'

/**
 * RBAC 服务初始化配置
 */
export interface RbacInitOptions {
  redis?: unknown // Redis client instance
  cacheTtl?: number // 缓存 TTL（秒）
}

/**
 * 初始化所有 RBAC 服务
 * 在应用启动时调用
 *
 * @example
 * ```typescript
 * // src/index.ts
 * import { initializeRbacServices } from './services/rbac'
 *
 * async function bootstrap() {
 *   // 初始化 RBAC 服务
 *   await initializeRbacServices({
 *     redis: redisClient, // 可选，不传则使用内存缓存
 *     cacheTtl: 300
 *   })
 *
 *   // 启动 Elysia 应用
 *   const app = new Elysia()
 *   // ...
 * }
 * ```
 */
export async function initializeRbacServices(
  options: RbacInitOptions = {}
): Promise<{
  permissionService: PermissionService
  ownershipService: OwnershipService
  scopeResolver: ScopeResolver
  cache: PermissionCache
}> {
  // 1. 创建缓存
  const cache = createPermissionCache(options.redis as any)

  // 2. 初始化权限服务
  const permissionService = await initializePermissionService(cache)

  // 3. 初始化所有权服务
  await initializeOwnershipService()

  // 4. 初始化 Scope 解析器
  await initializeScopeResolver()

  console.log('✅ RBAC services initialized')

  return {
    permissionService,
    ownershipService: getOwnershipService(),
    scopeResolver: getScopeResolver(),
    cache
  }
}

/**
 * 获取已初始化的服务实例
 * 确保先调用 initializeRbacServices()
 */
export function getRbacServices() {
  return {
    permissionService: getPermissionService(),
    ownershipService: getOwnershipService(),
    scopeResolver: getScopeResolver()
  }
}

/**
 * 清理所有 RBAC 服务资源
 * 在应用关闭时调用
 */
export function disposeRbacServices(): void {
  getPermissionService().dispose()
  getOwnershipService().dispose()
  // ScopeResolver 目前没有 dispose 需求
  console.log('✅ RBAC services disposed')
}
