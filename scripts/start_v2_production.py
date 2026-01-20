"""
TACN v2.0.0 - Production Startup Script

Quick start script for running TACN v2.0.0 in production mode
without Docker build delays.
"""

import subprocess
import sys
import os
import time
from pathlib import Path


def check_prerequisites():
    """Check if required dependencies are installed"""
    print("Checking prerequisites...")

    # Check Python version
    if sys.version_info < (3, 10):
        print("[FAIL] Python 3.10+ required")
        return False
    print(f"[OK] Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")

    # Check if MongoDB is accessible
    try:
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        print("[OK] MongoDB is accessible")
    except Exception as e:
        print(f"[WARN] MongoDB may not be available: {e}")

    # Check if Redis is accessible
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        r.ping()
        print("[OK] Redis is accessible")
    except Exception as e:
        print(f"[WARN] Redis may not be available: {e}")

    # Check required packages
    required_packages = [
        'fastapi', 'uvicorn', 'motor', 'pydantic', 'redis'
    ]
    missing = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)

    if missing:
        print(f"[WARN] Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False

    print("[OK] All required packages installed")
    return True


def start_backend():
    """Start the FastAPI backend server"""
    print("\n" + "=" * 60)
    print("Starting TACN v2.0.0 Backend Server")
    print("=" * 60)

    os.environ.setdefault('PYTHONUNBUFFERED', '1')
    os.environ.setdefault('APP_ENV', 'production')
    os.environ.setdefault('CACHE_ENABLED', 'true')
    os.environ.setdefault('PERFORMANCE_MONITORING_ENABLED', 'true')

    try:
        cmd = [
            sys.executable, '-m', 'uvicorn', 'app.main:app',
            '--host', '0.0.0.0',
            '--port', '8000',
            '--workers', '1',
            '--log-level', 'info',
            '--access-log'
        ]

        print("Command:", ' '.join(cmd))
        print("\nServer starting at http://localhost:8000")
        print("API docs available at http://localhost:8000/docs")
        print("Monitoring dashboard at http://localhost:8000/api/monitoring/summary")
        print("\nPress Ctrl+C to stop the server\n")

        subprocess.run(cmd)

    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"[ERROR] Failed to start server: {e}")
        return False

    return True


def main():
    """Main entry point"""
    print("\n" + "=" * 60)
    print("     TACN v2.0.0 - Production Startup")
    print("=" * 60)

    if not check_prerequisites():
        print("\n[FAIL] Prerequisites check failed. Please install missing dependencies.")
        print("Run: pip install -r requirements.txt")
        return 1

    print("\n[OK] All prerequisites met")
    print("[INFO] Starting TACN v2.0.0 backend server...\n")

    return 0 if start_backend() else 1


if __name__ == "__main__":
    sys.exit(main())
