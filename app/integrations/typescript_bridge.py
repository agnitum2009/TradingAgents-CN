"""
TACN v2.0 - TypeScript Services Bridge

Provides Python integration with TypeScript service layer.
This is the bridge that allows FastAPI to call TS services.
"""

import subprocess
import json
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class TypeScriptServiceBridge:
    """
    Bridge to call TypeScript services from Python.

    Uses Node.js subprocess to execute compiled TS services.
    """

    def __init__(self, ts_services_path: str = None):
        """
        Initialize the TypeScript bridge.

        Args:
            ts_services_path: Path to ts_services directory
        """
        if ts_services_path is None:
            # Default path relative to project root
            project_root = Path(__file__).parent.parent.parent
            ts_services_path = project_root / "ts_services"

        self.ts_services_path = Path(ts_services_path)
        self.build_path = self.ts_services_path / "build"
        self.node_path = "node"
        self._process: Optional[subprocess.Popen] = None

    async def initialize(self):
        """Initialize the TypeScript service bridge."""
        if not self.build_path.exists():
            raise RuntimeError(
                f"TypeScript services not built. "
                f"Run 'cd ts_services && npm run build' first."
            )

        logger.info(f"TypeScript bridge initialized: {self.build_path}")

    async def call_service(
        self,
        service: str,
        method: str,
        params: Dict[str, Any] = None
    ) -> Any:
        """
        Call a TypeScript service method.

        Args:
            service: Service name (e.g., 'TrendAnalysisService')
            method: Method name (e.g., 'analyze')
            params: Method parameters

        Returns:
            Result from TypeScript service
        """
        if params is None:
            params = {}

        # Create a temporary Node.js script to call the service
        script = f"""
const {{ {service} }} = require('./build/domain/analysis/trend-analysis.service');

async function main() {{
    try {{
        const svc = new {service}();
        const result = await svc.{method}({json.dumps(params)});
        console.log(JSON.stringify({{ success: true, data: result }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        # Run the script
        result = await self._run_node_script(script)
        return result

    async def _run_node_script(self, script: str) -> Any:
        """Run a Node.js script and return the result."""
        try:
            process = await asyncio.create_subprocess_exec(
                self.node_path,
                "--eval",
                script,
                cwd=str(self.build_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.error(f"Node.js script failed: {stderr.decode()}")
                raise RuntimeError(f"TypeScript service error: {stderr.decode()}")

            result = json.loads(stdout.decode())
            if not result.get("success"):
                raise RuntimeError(result.get("error", "Unknown error"))

            return result.get("data")

        except Exception as e:
            logger.error(f"Failed to run Node.js script: {e}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Check if TypeScript services are available."""
        try:
            script = """
console.log(JSON.stringify({ success: true, version: '2.0.0' }));
"""
            result = await self._run_node_script(script)
            return {
                "status": "healthy",
                "version": result.get("version"),
                "path": str(self.build_path)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global bridge instance
_ts_bridge: Optional[TypeScriptServiceBridge] = None


def get_ts_bridge() -> TypeScriptServiceBridge:
    """Get the global TypeScript bridge instance."""
    global _ts_bridge
    if _ts_bridge is None:
        _ts_bridge = TypeScriptServiceBridge()
    return _ts_bridge


async def initialize_ts_bridge():
    """Initialize the TypeScript bridge (called on startup)."""
    bridge = get_ts_bridge()
    await bridge.initialize()
    logger.info("TypeScript services bridge initialized")
