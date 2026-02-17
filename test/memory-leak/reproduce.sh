#!/bin/bash

# ========================================
# Issue #1744: Memory Leak in Multipart parser
# 复现脚本
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test-file.bin"
SERVER_PID=""

cleanup() {
	echo -e "\n🧹 Cleaning up..."
	[ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null || true
	rm -f "$TEST_FILE"
	exit 0
}

trap cleanup INT TERM

echo "========================================"
echo " Issue #1744: Memory Leak Reproduction"
echo "========================================"

# 1. 生成测试文件 (50MB)
echo -e "\n📦 Generating 50MB test file..."
dd if=/dev/urandom of="$TEST_FILE" bs=1M count=50 2>/dev/null
echo "   Created: $TEST_FILE"

# 2. 启动服务器
echo -e "\n🚀 Starting test server..."
cd "$SCRIPT_DIR"
bun run server.ts &
SERVER_PID=$!
sleep 2

# 检查服务器是否启动
if ! curl -s http://localhost:3001/health > /dev/null; then
	echo "❌ Server failed to start"
	cleanup
fi
echo "   Server PID: $SERVER_PID"

# 3. 测试函数
test_endpoint() {
	local endpoint=$1
	local label=$2
	local requests=${3:-5}

	echo -e "\n========================================"
	echo " Testing: $label"
	echo " Endpoint: $endpoint"
	echo " Requests: $requests"
	echo "========================================"

	# 初始内存
	local initial_mem=$(ps -o rss= -p $SERVER_PID 2>/dev/null || echo "0")
	echo -e "\n📊 Initial memory: $((initial_mem / 1024)) MB"

	for i in $(seq 1 $requests); do
		curl -s -X POST "http://localhost:3001${endpoint}" \
			-F "file=@$TEST_FILE" > /dev/null

		local mem=$(ps -o rss= -p $SERVER_PID 2>/dev/null || echo "0")
		echo "   Request $i: $((mem / 1024)) MB (+$(((mem - initial_mem) / 1024)) MB from start)"
		sleep 0.5
	done

	local final_mem=$(ps -o rss= -p $SERVER_PID 2>/dev/null || echo "0")
	echo -e "\n📈 Final memory: $((final_mem / 1024)) MB"
	echo "   Total increase: $(((final_mem - initial_mem) / 1024)) MB"
}

# 4. 运行测试
echo -e "\n⏳ Waiting for server to stabilize..."
sleep 2

# 测试有泄漏的端点
test_endpoint "/upload-default" "⚠️  Leaky Endpoint (built-in parser)" 10

echo -e "\n⏳ Cooldown..."
sleep 3

# 测试无泄漏端点
test_endpoint "/upload-noparse" "✅ Manual Parse (no leak)" 10

# 5. 总结
echo -e "\n========================================"
echo " 📋 Summary"
echo "========================================"
echo " If memory keeps growing on /upload-default"
echo " but stays stable on /upload-noparse,"
echo " you have reproduced the memory leak!"
echo "========================================"

cleanup
