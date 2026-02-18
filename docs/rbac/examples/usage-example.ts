// src/modules/projects/index.ts
// 示例：在路由中使用统一的 Guard/Macro 和 Scope 功能

import { Elysia, t } from 'elysia'
import { rbacMacros } from '../../http/macro'
import {
  createGuard,
  requirePermission,
  requireRole,
  requireOwnership,
  requirePermissionOrOwnership
} from '../../http/guard'
import { authMiddleware } from '../../http/middleware/auth'
import { db } from '../../db/prisma'
import {
  checkPermissionWithScope,
  mergeScopeWithQuery,
  buildScopedQuery,
  isAdmin
} from '../../services/rbac'

// ========== 方式一：使用 Macro（推荐）==========
export const projectModuleV1 = new Elysia({ prefix: '/projects' })
  .use(authMiddleware)
  .use(rbacMacros)

  // 列表查询（带 Scope）
  .get('/', async ({ user, query }) => {
    const { status, search, page = 1, limit = 20 } = query

    const baseFilter: Record<string, unknown> = {}
    if (status) baseFilter.status = status
    if (search) {
      baseFilter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const { where, skip, take } = await buildScopedQuery(
      user!.id,
      { resource: 'project', action: 'read' },
      baseFilter,
      { page, limit }
    )

    if (where.id === '__PERMISSION_DENIED__') {
      return { projects: [], total: 0, page, limit }
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({ where, skip, take }),
      db.project.count({ where })
    ])

    return { projects, total, page, limit }
  }, {
    requireAuth: true,
    query: t.Object({
      status: t.Optional(t.Union([t.Literal('ACTIVE'), t.Literal('ARCHIVED')])),
      search: t.Optional(t.String({ maxLength: 100 })),
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric())
    })
  })

  // 创建项目 - 使用 Macro
  .post('/', async ({ body, user }) => {
    const project = await db.project.create({
      data: { ...body, ownerId: user!.id }
    })
    return { project }
  }, {
    permission: ['project', 'create'],
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 500 }))
    })
  })

  // 更新项目 - 权限或所有权
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

  // 删除项目 - 需要任一权限
  .delete('/:id', async ({ params }) => {
    await db.project.delete({ where: { id: params.id } })
    return { message: '删除成功' }
  }, {
    anyPermission: [['project', 'delete'], ['project', 'manage']]
  })

// ========== 方式二：使用 Guard（适合模块级保护）==========
export const projectModuleV2 = new Elysia({ prefix: '/projects' })
  // 整个模块需要登录
  .use(createGuard({}))

  // 管理员专用路由
  .group('/admin', app =>
    app
      .use(createGuard(requireRole('admin')))
      .get('/stats', async () => {
        const total = await db.project.count()
        return { total }
      })
  )

  // 需要 project:read 权限的路由组
  .group('/', app =>
    app
      .use(createGuard(requirePermission('project', 'read')))
      .get('/', async ({ user }) => {
        // 这里的路由都已通过权限检查
        const { where } = await buildScopedQuery(
          user!.id,
          { resource: 'project', action: 'read' },
          {}
        )
        return db.project.findMany({ where })
      })
      .get('/:id', async ({ params }) => {
        return db.project.findUnique({ where: { id: params.id } })
      })
  )

  // 需要 project:update 权限或所有权的路由
  .put('/:id', async ({ params, body, user }) => {
    // Guard 已经验证了权限或所有权
    const project = await db.project.update({
      where: { id: params.id },
      data: body
    })
    return { project }
  })
  .use(createGuard(requirePermissionOrOwnership('project', 'update')))

// ========== 方式三：组合使用 ==========
export const projectModuleV3 = new Elysia({ prefix: '/projects' })
  .use(authMiddleware)
  .use(rbacMacros)

  // 单个路由使用 Macro
  .post('/', async ({ body, user }) => {
    const project = await db.project.create({
      data: { ...body, ownerId: user!.id }
    })
    return { project }
  }, {
    permission: ['project', 'create']
  })

  // 路由组使用 Guard
  .group('/admin', app =>
    app
      .use(createGuard(requireRole('admin')))
      .get('/all', async () => {
        // 管理员可以看到所有项目
        return db.project.findMany()
      })
      .delete('/cleanup', async () => {
        await db.project.deleteMany({ where: { status: 'ARCHIVED' } })
        return { message: '清理完成' }
      })
  )
