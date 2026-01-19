"""
Repository Base Classes

Provides abstract base classes for data access layer.
All repositories should inherit from these base classes.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from bson import ObjectId

from app.core.database import get_mongo_db


T = TypeVar('T')


@dataclass
class PaginationParams:
    """Pagination parameters"""
    page: int = 1
    page_size: int = 20
    sort_by: Optional[str] = None
    sort_order: int = 1  # 1 for ascending, -1 for descending


@dataclass
class PaginatedResult(Generic[T]):
    """Paginated result"""
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class Repository(ABC, Generic[T]):
    """
    Abstract base class for all repositories.

    Provides common CRUD operations and enforces a consistent interface.
    """

    def __init__(self, collection_name: str):
        """
        Initialize the repository.

        Args:
            collection_name: MongoDB collection name
        """
        self.collection_name = collection_name
        self._logger = logging.getLogger(self.__class__.__name__)

    @property
    def collection(self):
        """Get MongoDB collection"""
        db = get_mongo_db()
        return db[self.collection_name]

    @abstractmethod
    def _to_entity(self, document: Dict[str, Any]) -> T:
        """
        Convert MongoDB document to entity.

        Args:
            document: MongoDB document

        Returns:
            Entity instance
        """
        pass

    @abstractmethod
    def _to_document(self, entity: T) -> Dict[str, Any]:
        """
        Convert entity to MongoDB document.

        Args:
            entity: Entity instance

        Returns:
            MongoDB document
        """
        pass

    async def get(self, id: str) -> Optional[T]:
        """
        Get entity by ID.

        Args:
            id: Entity ID

        Returns:
            Entity or None if not found
        """
        try:
            document = await self.collection.find_one({'_id': ObjectId(id)})
            if document:
                return self._to_entity(document)
            return None
        except Exception as e:
            self._logger.error(f'Failed to get entity by id={id}: {e}')
            raise

    async def find_one(self, **filters) -> Optional[T]:
        """
        Find one entity by filters.

        Args:
            **filters: Filter criteria

        Returns:
            Entity or None if not found
        """
        try:
            document = await self.collection.find_one(filters)
            if document:
                return self._to_entity(document)
            return None
        except Exception as e:
            self._logger.error(f'Failed to find one: {e}')
            raise

    async def find(
        self,
        filters: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: int = 0,
        sort: Optional[List[tuple]] = None,
    ) -> List[T]:
        """
        Find entities by filters.

        Args:
            filters: Filter criteria
            skip: Number of documents to skip
            limit: Maximum number of documents to return
            sort: Sort specification [(field, direction), ...]

        Returns:
            List of entities
        """
        try:
            cursor = self.collection.find(filters or {})

            if skip:
                cursor = cursor.skip(skip)
            if limit:
                cursor = cursor.limit(limit)
            if sort:
                cursor = cursor.sort(sort)

            documents = await cursor.to_list(length=None)
            return [self._to_entity(doc) for doc in documents]
        except Exception as e:
            self._logger.error(f'Failed to find: {e}')
            raise

    async def paginate(
        self,
        filters: Optional[Dict[str, Any]] = None,
        params: Optional[PaginationParams] = None,
    ) -> PaginatedResult[T]:
        """
        Find entities with pagination.

        Args:
            filters: Filter criteria
            params: Pagination parameters

        Returns:
            Paginated result
        """
        params = params or PaginationParams()
        filters = filters or {}

        try:
            # Get total count
            total = await self.collection.count_documents(filters)

            # Calculate pagination
            skip = (params.page - 1) * params.page_size

            # Build sort specification
            sort = None
            if params.sort_by:
                sort = [(params.sort_by, params.sort_order)]

            # Get items
            items = await self.find(
                filters=filters,
                skip=skip,
                limit=params.page_size,
                sort=sort,
            )

            return PaginatedResult(
                items=items,
                total=total,
                page=params.page,
                page_size=params.page_size,
                has_next=skip + params.page_size < total,
                has_prev=params.page > 1,
            )
        except Exception as e:
            self._logger.error(f'Failed to paginate: {e}')
            raise

    async def save(self, entity: T) -> T:
        """
        Save entity (insert or update).

        Args:
            entity: Entity to save

        Returns:
            Saved entity
        """
        document = self._to_document(entity)

        # Check if entity has an ID
        entity_id = document.get('id')
        if entity_id:
            # Update existing
            try:
                document['updated_at'] = datetime.utcnow()
                await self.collection.update_one(
                    {'_id': ObjectId(entity_id)},
                    {'$set': document},
                )
                return entity
            except Exception as e:
                self._logger.error(f'Failed to update entity id={entity_id}: {e}')
                raise
        else:
            # Insert new
            try:
                document['created_at'] = datetime.utcnow()
                document['updated_at'] = datetime.utcnow()
                result = await self.collection.insert_one(document)
                document['id'] = str(result.inserted_id)
                return self._to_entity(document)
            except Exception as e:
                self._logger.error(f'Failed to insert entity: {e}')
                raise

    async def delete(self, id: str) -> bool:
        """
        Delete entity by ID.

        Args:
            id: Entity ID

        Returns:
            True if deleted, False if not found
        """
        try:
            result = await self.collection.delete_one({'_id': ObjectId(id)})
            return result.deleted_count > 0
        except Exception as e:
            self._logger.error(f'Failed to delete entity id={id}: {e}')
            raise

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities by filters.

        Args:
            filters: Filter criteria

        Returns:
            Count of entities
        """
        try:
            return await self.collection.count_documents(filters or {})
        except Exception as e:
            self._logger.error(f'Failed to count: {e}')
            raise

    async def exists(self, **filters) -> bool:
        """
        Check if entity exists by filters.

        Args:
            **filters: Filter criteria

        Returns:
            True if exists, False otherwise
        """
        return await self.count(filters) > 0

    async def aggregate(self, pipeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Run aggregation pipeline.

        Args:
            pipeline: Aggregation pipeline

        Returns:
            Aggregation results
        """
        try:
            cursor = self.collection.aggregate(pipeline)
            return await cursor.to_list(length=None)
        except Exception as e:
            self._logger.error(f'Failed to aggregate: {e}')
            raise


class SyncRepository(ABC, Generic[T]):
    """
    Synchronous repository for non-async contexts.

    Uses synchronous MongoDB client.
    """

    def __init__(self, collection_name: str):
        """
        Initialize the repository.

        Args:
            collection_name: MongoDB collection name
        """
        self.collection_name = collection_name
        self._logger = logging.getLogger(self.__class__.__name__)

    @property
    def collection(self):
        """Get MongoDB collection (sync)"""
        # Use synchronous MongoDB client
        client = MongoClient('mongodb://localhost:27017')
        return client['tradingagents'][self.collection_name]

    @abstractmethod
    def _to_entity(self, document: Dict[str, Any]) -> T:
        """Convert MongoDB document to entity"""
        pass

    @abstractmethod
    def _to_document(self, entity: T) -> Dict[str, Any]:
        """Convert entity to MongoDB document"""
        pass

    def find_one(self, **filters) -> Optional[T]:
        """Find one entity by filters"""
        document = self.collection.find_one(filters or {})
        if document:
            return self._to_entity(document)
        return None

    def find(self, filters: Optional[Dict[str, Any]] = None, limit: int = 0) -> List[T]:
        """Find entities by filters"""
        cursor = self.collection.find(filters or {})
        if limit:
            cursor = cursor.limit(limit)
        return [self._to_entity(doc) for doc in cursor]

    def save(self, entity: T) -> T:
        """Save entity"""
        document = self._to_document(entity)
        entity_id = document.get('id')
        if entity_id:
            document['updated_at'] = datetime.utcnow()
            self.collection.update_one(
                {'_id': ObjectId(entity_id)},
                {'$set': document},
            )
            return entity
        else:
            document['created_at'] = datetime.utcnow()
            document['updated_at'] = datetime.utcnow()
            result = self.collection.insert_one(document)
            document['id'] = str(result.inserted_id)
            return self._to_entity(document)
