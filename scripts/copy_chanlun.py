"""
复制 chan.py 模块到 chanlun 目录
"""
import os
import shutil
from pathlib import Path

# 源目录和目标目录
src_dir = Path(r"D:\chan.py")
dst_dir = Path(r"D:\tacn\chanlun")

# 需要复制的模块列表
modules = [
    "Common",
    "KLine",
    "Bi",
    "Seg",
    "ZS",
    "BuySellPoint",
    "Combiner",
    "DataAPI",
    "Math",
    "Plot",
    "ChanModel",
    "CustomBuySellPoint",
]

# 根目录文件
root_files = [
    "Chan.py",
    "ChanConfig.py",
    "__init__.py",
    "main.py",
    "LICENSE",
]

def copy_file(src, dst):
    """复制单个文件"""
    try:
        shutil.copy2(src, dst)
        print(f"[OK] {src.name}")
        return True
    except Exception as e:
        print(f"[FAIL] {src.name}: {e}")
        return False

def main():
    print("开始复制 chan.py 模块...")
    print(f"源目录: {src_dir}")
    print(f"目标目录: {dst_dir}")
    print("-" * 50)

    # 复制根目录文件
    print("\n[根目录文件]")
    for file_name in root_files:
        src_file = src_dir / file_name
        if src_file.exists():
            dst_file = dst_dir / file_name
            copy_file(src_file, dst_file)

    # 复制模块目录
    for module in modules:
        src_module_dir = src_dir / module
        dst_module_dir = dst_dir / module

        if src_module_dir.exists() and src_module_dir.is_dir():
            print(f"\n[{module}]")
            # 确保目标目录存在
            dst_module_dir.mkdir(parents=True, exist_ok=True)

            # 复制所有 .py 文件
            for py_file in src_module_dir.glob("*.py"):
                dst_file = dst_module_dir / py_file.name
                copy_file(py_file, dst_file)

    print("\n" + "-" * 50)
    print("复制完成!")

if __name__ == "__main__":
    main()
