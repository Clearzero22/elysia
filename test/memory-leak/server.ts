import { Elysia } from '../../src'

/**
 * Issue #1744: Memory Leak in Multipart parser
 * 复现测试服务器
 */

const app = new Elysia()
	// ❌ 有内存泄漏的端点 - 使用内置 multipart 解析器
	.post('/upload-default', async ({ body }) => {
		console.log('[LEAK] Received file upload, body keys:', Object.keys(body as object))
		return { status: 'ok', endpoint: 'leaky' }
	}, {
		body: 'multipart/form-data'
	})

	// ✅ 无泄漏的对照组 - 手动解析
	.post('/upload-noparse', async ({ request }) => {
		const form = await request.formData()
		console.log('[OK] Manual parse, file:', (form.get('file') as File)?.name)
		return { status: 'ok', endpoint: 'manual' }
	})

	// 健康检查
	.get('/health', () => ({ status: 'healthy' }))

	.listen(3001, ({ hostname, port }) => {
		console.log(`\n🚀 Memory Leak Test Server`)
		console.log(`   http://${hostname}:${port}`)
		console.log(`\n   POST /upload-default  - ⚠️  有内存泄漏`)
		console.log(`   POST /upload-noparse  - ✅ 无泄漏对照`)
		console.log(`   GET  /health          - 健康检查\n`)
	})
