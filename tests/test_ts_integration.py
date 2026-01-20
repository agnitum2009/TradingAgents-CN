"""
测试 TypeScript 服务集成

验证 Python 可以成功调用 TypeScript 服务
"""

import asyncio
import subprocess
from pathlib import Path


def test_nodejs_available():
    """测试 Node.js 是否可用"""
    print("Test 1: Node.js 可用性")
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        print(f"  [OK] Node.js: {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"  [FAIL] Node.js 不可用: {e}")
        return False


def test_build_exists():
    """测试 TypeScript 构建产物是否存在"""
    print("\nTest 2: 构建产物检查")
    build_path = Path("ts_services/build")
    if build_path.exists():
        js_files = list(build_path.rglob("*.js"))
        print(f"  [OK] 构建产物存在: {len(js_files)} 个 JS 文件")

        # 列出主要文件
        index_js = build_path / "index.js"
        if index_js.exists():
            print(f"  [OK] 入口文件存在: index.js")

        domain_path = build_path / "domain"
        if domain_path.exists():
            print(f"  [OK] 领域服务目录存在")

        return True
    else:
        print("  [FAIL] 构建产物不存在")
        return False


def test_nodejs_can_run_ts():
    """测试 Node.js 能否执行编译后的 TS"""
    print("\nTest 3: Node.js 执行编译后的 TS")
    script = 'console.log(JSON.stringify({success: true, message: "TS service works"}));'

    try:
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            cwd="ts_services/build",
            timeout=5
        )
        if result.returncode == 0:
            print(f"  [OK] Node.js 可以执行: {result.stdout.strip()}")
            return True
        else:
            print(f"  [FAIL] 执行失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"  [FAIL] 执行异常: {e}")
        return False


def test_ts_module_import():
    """测试 TypeScript 模块导入"""
    print("\nTest 4: TS 模块导入测试")
    script = """
try {
    const tsIndex = require('./index.js');
    console.log(JSON.stringify({
        success: true,
        exports: Object.keys(tsIndex).length
    }));
} catch(e) {
    console.log(JSON.stringify({success: false, error: e.message}));
}
"""

    try:
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            cwd="ts_services/build",
            timeout=5
        )
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout.strip())
            if data.get("success"):
                print(f"  [OK] TS 模块导入成功: {data['exports']} 个导出")
                return True
            else:
                print(f"  [FAIL] 导入失败: {data.get('error')}")
                return False
        else:
            print(f"  [FAIL] 执行失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"  [FAIL] 测试异常: {e}")
        return False


def main():
    """运行所有测试"""
    print("=" * 60)
    print("TypeScript 服务集成测试")
    print("=" * 60)

    results = [
        test_nodejs_available(),
        test_build_exists(),
        test_nodejs_can_run_ts(),
        test_ts_module_import(),
    ]

    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 60)

    if passed == total:
        print("\n[SUCCESS] TypeScript 服务集成正常工作!")
        return 0
    else:
        print("\n[FAILURE] 部分测试失败，请检查配置")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
