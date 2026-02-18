// src/services/rbac/scope-resolver.ts

import { AsyncInitializable } from './base-service'
import { db } from '../../db/prisma'
import type { ScopeContext, UserPermissionContext } from './types'

/**
 * Scope 条件定义（存储在数据库中的格式）
 */
interface ScopeConditionDefinition {
  resource: string
  type: 'simple' | 'relation' | 'custom'
  // simple 类型：直接的字段条件
  field?: string
  operator?: '=' | 'IN' | '>' | '<' | '>=' | '<='
  valueSource?: 'user_field' | 'parameter' | 'static'
  // relation 类型：通过关联表查询
  relation?: {
    model: string
    localField: string
    foreignField: string
    condition: ScopeConditionDefinition
  }
  // custom 类型：自定义条件构建器名称
  builder?: string
}

/**
 * Scope 策略数据
 */
interface ScopePolicyData {
  id: string
  name: string
  resource: string
  conditions: ScopeConditionDefinition
}

/**
 * 自定义条件构建器函数类型
 */
type ConditionBuilder = (
  context: ScopeResolutionContext
) => Record<string, unknown> | Promise<Record<string, unknown>>

/**
 * Scope 解析上下文
 */
export interface ScopeResolutionContext {
  userId: string
  userFields: Record<string, unknown>
  parameters: Record<string, unknown>
}

/**
 * Scope 解析器
 * 将 ScopePolicy 中存储的条件转换为 Prisma where 子句
 */
export class ScopeResolver extends AsyncInitializable {
  private scopePolicies = new Map<string, ScopePolicyData[]>()
  private customBuilders = new Map<string, ConditionBuilder>()

  /**
   * 注册自定义条件构建器
   */
  registerBuilder(name: string, builder: ConditionBuilder): void {
    this.customBuilders.set(name, builder)
  }

  /**
   * 初始化：加载 Scope 策略
   */
  protected async onInitialize(): Promise<void> {
    await this.loadScopePolicies()
    this.registerDefaultBuilders()
  }

  /**
   * 从数据库加载 Scope 策略
   */
  private async loadScopePolicies(): Promise<void> {
    const policies = await db.scopePolicy.findMany()

    const newPolicies = new Map<string, ScopePolicyData[]>()

    for (const policy of policies) {
      try {
        const conditions: ScopeConditionDefinition = JSON.parse(policy.conditions)

        const data: ScopePolicyData = {
          id: policy.id,
          name: policy.name,
          resource: policy.resource,
          conditions
        }

        const list = newPolicies.get(policy.resource) || []
        list.push(data)
        newPolicies.set(policy.resource, list)
      } catch (error) {
        console.error(`Failed to parse scope policy ${policy.id}:`, error)
      }
    }

    this.scopePolicies = newPolicies
  }

  /**
   * 注册默认的条件构建器
   */
  private registerDefaultBuilders(): void {
    // 部门数据范围
    this.registerBuilder('own_department', async (ctx) => ({
      departmentId: ctx.userFields.departmentId
    }))

    // 团队数据范围
    this.registerBuilder('own_team', async (ctx) => ({
      teamId: { in: ctx.parameters.teamIds as string[] }
    }))

    // 组织数据范围
    this.registerBuilder('own_organization', async (ctx) => ({
      organizationId: ctx.userFields.organizationId
    }))
  }

  /**
   * 为资源解析 Scope 条件
   * 返回 Prisma where 子句
   */
  async resolveScope(
    resource: string,
    userContext: UserPermissionContext
  ): Promise<Record<string, unknown> | null> {
    await this.ensureInitialized()

    const policies = this.scopePolicies.get(resource)
    if (!policies || policies.length === 0) {
      return null
    }

    // 获取用户对应的 Scope
    const userScopes = userContext.scopes.filter(
      s => s.conditions.resource === resource
    )

    if (userScopes.length === 0) {
      return null
    }

    // 加载用户字段（用于条件解析）
    const userFields = await this.loadUserFields(
      userContext.userId,
      userScopes
    )

    // 解析所有 Scope 条件
    const conditions: Record<string, unknown>[] = []

    for (const scope of userScopes) {
      const resolutionContext: ScopeResolutionContext = {
        userId: userContext.userId,
        userFields,
        parameters: scope.parameters || {}
      }

      const condition = await this.resolveCondition(
        scope.type,
        resolutionContext
      )

      if (condition) {
        conditions.push(condition)
      }
    }

    // 合并条件（取交集）
    if (conditions.length === 0) {
      return null
    }

    if (conditions.length === 1) {
      return conditions[0]
    }

    return { AND: conditions }
  }

  /**
   * 解析单个 Scope 条件
   */
  private async resolveCondition(
    scopeType: string,
    context: ScopeResolutionContext
  ): Promise<Record<string, unknown> | null> {
    // 检查是否有自定义构建器
    const builder = this.customBuilders.get(scopeType)
    if (builder) {
      return builder(context)
    }

    // 默认处理：直接使用 parameters 作为条件
    return context.parameters
  }

  /**
   * 加载用户字段（用于条件解析）
   */
  private async loadUserFields(
    userId: string,
    scopes: ScopeContext[]
  ): Promise<Record<string, unknown>> {
    // 收集需要的字段
    const requiredFields = new Set<string>()

    for (const scope of scopes) {
      const params = scope.parameters || {}
      Object.values(params).forEach(value => {
        if (typeof value === 'string' && value.startsWith('$user.')) {
          const field = value.replace('$user.', '')
          requiredFields.add(field)
        }
      })
    }

    if (requiredFields.size === 0) {
      return {}
    }

    // 查询用户字段
    const user = await db.user.findUnique({
      where: { id: userId },
      select: Object.fromEntries(
        Array.from(requiredFields).map(f => [f, true])
      )
    })

    return user || {}
  }

  /**
   * 刷新 Scope 策略缓存
   */
  async refreshPolicies(): Promise<void> {
    await this.loadScopePolicies()
  }
}

// 单例实例
let scopeResolverInstance: ScopeResolver | null = null

/**
 * 获取 Scope 解析器单例
 */
export function getScopeResolver(): ScopeResolver {
  if (!scopeResolverInstance) {
    scopeResolverInstance = new ScopeResolver()
  }
  return scopeResolverInstance
}

/**
 * 初始化 Scope 解析器
 */
export async function initializeScopeResolver(): Promise<void> {
  const resolver = getScopeResolver()
  await resolver.ensureInitialized()
}
