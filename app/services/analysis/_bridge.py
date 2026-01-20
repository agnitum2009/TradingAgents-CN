"""
Python Analysis Service Bridge

JSON-RPC server for TypeScript to call Python analysis services.
This bridges the TypeScript repository layer with Python persistence.

Based on:
- app/services/analysis_service.py (AnalysisService)
- app/models/analysis.py (AnalysisTask, AnalysisBatch, AnalysisResult)
"""

import sys
import os
import json
import asyncio
import logging
import io
from typing import Any, Dict, Optional
from datetime import datetime
from pathlib import Path


# Custom TextIOWrapper that properly implements isatty()
class UTF8TextIOWrapper(io.TextIOWrapper):
    """TextIOWrapper that properly implements isatty() for logging compatibility"""

    def isatty(self) -> bool:
        # Check if the underlying buffer is a TTY
        try:
            # First try the buffer
            if hasattr(self.buffer, 'isatty') and not self.buffer.closed:
                return self.buffer.isatty()
        except (AttributeError, OSError, ValueError):
            pass

        # Fall back to checking the original stdout/stderr
        try:
            if self is sys.stdout and hasattr(sys.__stdout__, 'isatty'):
                return sys.__stdout__.isatty()
            elif self is sys.stderr and hasattr(sys.__stderr__, 'isatty'):
                return sys.__stderr__.isatty()
        except (AttributeError, OSError, ValueError):
            pass

        # Default to False (not a TTY)
        return False

    def __getattr__(self, name):
        # Proxy any other attribute to the original stdout/stderr
        if hasattr(sys.__stdout__, name):
            return getattr(sys.__stdout__, name)
        if hasattr(sys.__stderr__, name):
            return getattr(sys.__stderr__, name)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")


# Configure UTF-8 encoding for stdout/stderr (Windows compatibility)
# This fixes emoji encoding issues in log output
# IMPORTANT: Must be done BEFORE any imports that might configure logging
if sys.platform == 'win32':
    sys.stdout = UTF8TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = UTF8TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Lazy imports to avoid triggering logging setup during module load
# These are imported only when the bridge is actually used
_analysis_service = None
_analysis_models = None


def _get_analysis_service():
    """Lazy import of AnalysisService"""
    global _analysis_service
    if _analysis_service is None:
        from app.services.analysis_service import AnalysisService
        _analysis_service = AnalysisService
    return _analysis_service


def _get_analysis_models():
    """Lazy import of analysis models"""
    global _analysis_models
    if _analysis_models is None:
        from app.models.analysis import (
            AnalysisTask,
            AnalysisBatch,
            AnalysisResult,
            AnalysisStatus,
            BatchStatus,
        )
        _analysis_models = {
            'AnalysisTask': AnalysisTask,
            'AnalysisBatch': AnalysisBatch,
            'AnalysisResult': AnalysisResult,
            'AnalysisStatus': AnalysisStatus,
            'BatchStatus': BatchStatus,
        }
    return _analysis_models


logger = logging.getLogger(__name__)


class AnalysisServiceBridge:
    """Bridge service for TypeScript to call Python analysis services"""

    def __init__(self):
        AnalysisServiceClass = _get_analysis_service()
        self.analysis_service = AnalysisServiceClass()

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle JSON-RPC request from TypeScript

        Args:
            request: JSON-RPC request with method and params

        Returns:
            JSON-RPC response with result or error
        """
        try:
            method = request.get("method")
            params = request.get("params", [])

            logger.info(f"[Bridge] Received request: {method}")

            # Route to appropriate handler
            if method == "create_task":
                return await self._create_task(*params)
            elif method == "get_task":
                return await self._get_task(*params)
            elif method == "update_task_status":
                return await self._update_task_status(*params)
            elif method == "save_result":
                return await self._save_result(*params)
            elif method == "cancel_task":
                return await self._cancel_task(*params)
            elif method == "get_tasks_by_user":
                return await self._get_tasks_by_user(*params)
            elif method == "get_tasks_by_batch":
                return await self._get_tasks_by_batch(*params)
            elif method == "get_user_stats":
                return await self._get_user_stats(*params)
            elif method == "create_batch":
                return await self._create_batch(*params)
            elif method == "get_batch":
                return await self._get_batch(*params)
            elif method == "update_batch_status":
                return await self._update_batch_status(*params)
            elif method == "cancel_batch":
                return await self._cancel_batch(*params)
            elif method == "get_user_batch_summary":
                return await self._get_user_batch_summary(*params)
            else:
                return {
                    "error": {
                        "code": -32601,
                        "message": f"Unknown method: {method}",
                        "data": {"method": method}
                    }
                }

        except Exception as e:
            logger.error(f"[Bridge] Error handling request: {method}", exc_info=True)
            return {
                "error": {
                    "code": -32603,
                    "message": str(e),
                    "data": {"method": method}
                }
            }

    async def _create_task(
        self,
        user_id: str,
        symbol: str,
        parameters: Dict[str, Any],
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an analysis task"""
        models = _get_analysis_models()
        AnalysisTask = models['AnalysisTask']
        AnalysisStatus = models['AnalysisStatus']

        task = AnalysisTask(
            task_id=self._generate_uuid(),
            user_id=self._convert_user_id(user_id),
            symbol=symbol,
            parameters=parameters,
            batch_id=batch_id,
            status=AnalysisStatus.PENDING,
            progress=0
        )

        # Save to MongoDB
        db = self._get_mongo_db()
        result = db.analysis_tasks.insert_one(task.model_dump(by_alias=True))

        return {
            "success": True,
            "data": task.model_dump(by_alias=True),
            "inserted_id": str(result.inserted_id)
        }

    async def _get_task(self, task_id: str) -> Dict[str, Any]:
        """Get task by task_id"""
        db = self._get_mongo_db()
        task_dict = db.analysis_tasks.find_one({"task_id": task_id})

        if task_dict:
            # Convert ObjectId to string
            task_dict["_id"] = str(task_dict["_id"])
            task_dict["id"] = task_dict.get("id") or str(task_dict.get("_id"))
            return {"success": True, "data": task_dict}

        return {
            "error": {
                "code": 404,
                "message": f"Task not found: {task_id}"
            }
        }

    async def _update_task_status(
        self,
        task_id: str,
        status: str,
        progress: int,
        message: Optional[str] = None,
        current_step: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update task status"""
        models = _get_analysis_models()
        AnalysisStatus = models['AnalysisStatus']
        db = self._get_mongo_db()

        update_data = {
            "status": status,
            "progress": progress,
            "updated_at": datetime.utcnow()
        }

        if message:
            update_data["message"] = message
        if current_step:
            update_data["current_step"] = current_step

        if status == AnalysisStatus.PROCESSING and not update_data.get("started_at"):
            update_data["started_at"] = datetime.utcnow()
        elif status in [AnalysisStatus.COMPLETED, AnalysisStatus.FAILED, AnalysisStatus.CANCELLED]:
            if not update_data.get("completed_at"):
                update_data["completed_at"] = datetime.utcnow()

        result = db.analysis_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )

        return {
            "success": True,
            "matched_count": result.matched_count
        }

    async def _save_result(
        self,
        task_id: str,
        result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save analysis result"""
        db = self._get_mongo_db()

        # Update task with result
        update_data = {
            "result": result,
            "status": AnalysisStatus.COMPLETED,
            "progress": 100,
            "completed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        db.analysis_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )

        # Record token usage if available
        tokens_used = result.get("tokens_used", 0)
        if tokens_used > 0:
            # TODO: Record to usage statistics
            pass

        return {"success": True, "tokens_used": tokens_used}

    async def _cancel_task(self, task_id: str) -> Dict[str, Any]:
        """Cancel a task"""
        db = self._get_mongo_db()

        result = db.analysis_tasks.update_one(
            {"task_id": task_id, "status": {"$in": [AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]}},
            {
                "$set": {
                    "status": AnalysisStatus.CANCELLED,
                    "cancelled_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return {
            "success": True,
            "cancelled": result.matched_count > 0
        }

    async def _get_tasks_by_user(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> Dict[str, Any]:
        """Get tasks by user"""
        db = self._get_mongo_db()

        query = {"user_id": self._convert_user_id(user_id)}
        if status:
            query["status"] = status

        cursor = db.analysis_tasks.find(query).sort("created_at", -1).skip(skip).limit(limit)
        tasks = []
        async for task_doc in cursor:
            task_doc["_id"] = str(task_doc["_id"])
            task_doc["id"] = task_doc.get("id") or str(task_doc.get("_id"))
            tasks.append(task_doc)

        return {"success": True, "data": tasks, "count": len(tasks)}

    async def _get_tasks_by_batch(self, batch_id: str) -> Dict[str, Any]:
        """Get tasks by batch_id"""
        db = self._get_mongo_db()

        cursor = db.analysis_tasks.find({"batch_id": batch_id}).sort("created_at", 1)
        tasks = []
        async for task_doc in cursor:
            task_doc["_id"] = str(task_doc["_id"])
            task_doc["id"] = task_doc.get("id") or str(task_doc.get("_id"))
            tasks.append(task_doc)

        return {"success": True, "data": tasks}

    async def _get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get user task statistics"""
        db = self._get_mongo_db()

        pipeline = [
            {
                "$match": {"user_id": self._convert_user_id(user_id)}
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "total": {"$sum": 1},
                    "completed": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", AnalysisStatus.COMPLETED]}, 1, 0]
                        }
                    },
                    "processing": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", AnalysisStatus.PROCESSING]}, 1, 0]
                        }
                    },
                    "failed": {
                        "$sum": {
                            "$cond": [
                                {"$in": ["$status", [AnalysisStatus.FAILED, AnalysisStatus.CANCELLED]]},
                                1,
                                0
                            ]
                        }
                    },
                    "pending": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", AnalysisStatus.PENDING]}, 1, 0]
                        }
                    }
                }
            }
        ]

        results = await db.analysis_tasks.aggregate(pipeline).to_list(None)

        if results:
            stats = results[0]
            # Get total token usage
            token_result = await db.analysis_tasks.aggregate([
                {"$match": {"user_id": self._convert_user_id(user_id), "result.tokens_used": {"$exists": True}}},
                {"$group": {"_id": None, "total_tokens": {"$sum": "$result.tokens_used"}}}
            ]).to_list(None)

            total_tokens = token_result[0]["total_tokens"] if token_result else 0

            # Calculate average execution time
            time_result = await db.analysis_tasks.aggregate([
                {"$match": {"user_id": self._convert_user_id(user_id), "completed_at": {"$exists": True}, "started_at": {"$exists": True}}},
                {"$project": {
                    "exec_time": {"$subtract": ["$completed_at", "$started_at"]}
                }},
                {"$group": {"_id": None, "avg_time": {"$avg": "$exec_time"}}}
            ]).to_list(None)

            avg_time = time_result[0]["avg_time"] if time_result else 0

            return {
                "success": True,
                "data": {
                    "user_id": user_id,
                    "total": stats["total"],
                    "pending": stats["pending"],
                    "processing": stats["processing"],
                    "completed": stats["completed"],
                    "failed": stats["failed"],
                    "total_tokens_used": total_tokens,
                    "avg_execution_time": avg_time
                }
            }

        return {
            "error": {
                "code": 404,
                "message": f"User not found or has no tasks: {user_id}"
            }
        }

    async def _create_batch(
        self,
        user_id: str,
        symbols: list,
        parameters: Dict[str, Any],
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an analysis batch"""
        from app.models.analysis import AnalysisBatch

        batch = AnalysisBatch(
            batch_id=self._generate_uuid(),
            user_id=self._convert_user_id(user_id),
            title=title or f"Batch Analysis ({len(symbols)} stocks)",
            description=description,
            total_tasks=len(symbols),
            parameters=parameters,
            status=BatchStatus.PENDING,
            progress=0
        )

        # Save to MongoDB
        db = self._get_mongo_db()
        result = db.analysis_batches.insert_one(batch.model_dump(by_alias=True))

        return {
            "success": True,
            "data": batch.model_dump(by_alias=True),
            "inserted_id": str(result.inserted_id)
        }

    async def _get_batch(self, batch_id: str) -> Dict[str, Any]:
        """Get batch by batch_id"""
        db = self._get_mongo_db()
        batch_dict = db.analysis_batches.find_one({"batch_id": batch_id})

        if batch_dict:
            batch_dict["_id"] = str(batch_dict["_id"])
            batch_dict["id"] = batch_dict.get("id") or str(batch_dict.get("_id"))
            return {"success": True, "data": batch_dict}

        return {
            "error": {
                "code": 404,
                "message": f"Batch not found: {batch_id}"
            }
        }

    async def _update_batch_status(
        self,
        batch_id: str,
        status: str,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update batch status"""
        db = self._get_mongo_db()

        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }

        if started_at:
            update_data["started_at"] = datetime.fromisoformat(started_at)
        if completed_at:
            update_data["completed_at"] = datetime.fromisoformat(completed_at)

        result = db.analysis_batches.update_one(
            {"batch_id": batch_id},
            {"$set": update_data}
        )

        return {
            "success": True,
            "matched_count": result.matched_count
        }

    async def _cancel_batch(self, batch_id: str) -> Dict[str, Any]:
        """Cancel a batch"""
        db = self._get_mongo_db()

        # Cancel batch
        batch_result = db.analysis_batches.update_one(
            {"batch_id": batch_id, "status": {"$in": [BatchStatus.PENDING, BatchStatus.PROCESSING]}},
            {
                "$set": {
                    "status": BatchStatus.CANCELLED,
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )

        # Cancel all pending/processing tasks in the batch
        task_result = db.analysis_tasks.update_many(
            {"batch_id": batch_id, "status": {"$in": [AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]}},
            {
                "$set": {
                    "status": AnalysisStatus.CANCELLED,
                    "cancelled_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return {
            "success": True,
            "batch_cancelled": batch_result.matched_count > 0,
            "tasks_cancelled": task_result.modified_count
        }

    async def _get_user_batch_summary(self, user_id: str) -> Dict[str, Any]:
        """Get user batch summary"""
        db = self._get_mongo_db()

        pipeline = [
            {
                "$match": {"user_id": self._convert_user_id(user_id)}
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "total": {"$sum": 1},
                    "active": {
                        "$sum": {
                            "$cond": [
                                {"$in": ["$status", [BatchStatus.PENDING, BatchStatus.PROCESSING]]},
                                1,
                                0
                            ]
                        }
                    },
                    "completed": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", BatchStatus.COMPLETED]}, 1, 0]
                        }
                    },
                    "failed": {
                        "$sum": {
                            "$cond": [
                                {"$in": ["$status", [BatchStatus.FAILED, BatchStatus.CANCELLED]]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]

        results = await db.analysis_batches.aggregate(pipeline).to_list(None)

        if results:
            stats = results[0]
            # Get total tasks
            tasks_result = await db.analysis_batches.aggregate([
                {"$match": {"user_id": self._convert_user_id(user_id)}},
                {"$group": {"_id": None, "total_tasks": {"$sum": "$total_tasks"}}}
            ]).to_list(None)

            total_tasks = tasks_result[0]["total_tasks"] if tasks_result else 0
            completed_tasks = stats.get("completed", 0)

            return {
                "success": True,
                "data": {
                    "user_id": user_id,
                    "total": stats["total"],
                    "active": stats["active"],
                    "completed": stats["completed"],
                    "failed": stats["failed"],
                    "total_tasks": total_tasks,
                    "total_completed": completed_tasks
                }
            }

        return {
            "error": {
                "code": 404,
                "message": f"User has no batches: {user_id}"
            }
        }

    # Helper methods

    def _generate_uuid(self) -> str:
        """Generate a UUID string"""
        import uuid
        return str(uuid.uuid4())

    def _convert_user_id(self, user_id: str):
        """Convert string user_id to PyObjectId"""
        from app.models.user import PyObjectId
        from bson import ObjectId

        if user_id == "admin":
            return PyObjectId(ObjectId("507f1f77bcf86cd799439011"))

        try:
            return PyObjectId(ObjectId(user_id))
        except:
            # Generate new ObjectId if invalid
            return PyObjectId(ObjectId())

    def _get_mongo_db(self):
        """Get MongoDB database instance"""
        from app.core.database import get_mongo_db
        return get_mongo_db()


# Global bridge instance
_bridge_instance: Optional[AnalysisServiceBridge] = None


def get_bridge() -> AnalysisServiceBridge:
    """Get or create the bridge instance"""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = AnalysisServiceBridge()
    return _bridge_instance


# Main server loop for JSON-RPC
async def main():
    """Main server loop for handling JSON-RPC requests"""

    # On Windows, reconfigure logging handlers to use UTF-8 streams
    if sys.platform == 'win32':
        import logging.config
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            if isinstance(handler, logging.StreamHandler):
                # Replace the stream with our UTF-8 wrapped stream
                if handler.stream == sys.__stdout__:
                    handler.stream = sys.stdout
                elif handler.stream == sys.__stderr__:
                    handler.stream = sys.stderr

    logger.info("Starting AnalysisServiceBridge...")

    # Print ready signal
    print(json.dumps({"status": "ready"}))
    sys.stdout.flush()

    bridge = get_bridge()

    # Read commands from stdin
    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                response = await bridge.handle_request(request)

                # Send response
                print(json.dumps(response))
                sys.stdout.flush()

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {e}")
                print(json.dumps({
                    "error": {
                        "code": -32700,
                        "message": f"Invalid JSON: {e}"
                    }
                }))
                sys.stdout.flush()

        except KeyboardInterrupt:
            logger.info("Shutting down AnalysisServiceBridge")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}", exc_info=True)
            # Print error response
            print(json.dumps({
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }))
            sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())
