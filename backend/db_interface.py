"""
Unified Database Interface for SydLivingAI
==========================================
Provides a repository abstraction layer decoupling application logic from the
underlying persistence store.

- When USE_DYNAMODB=true (and connected): queries AWS DynamoDB Single-Table repository.
- Otherwise: queries local SQLite database (sydliving.db) and in-memory stores.
"""

import os
import sqlite3
from typing import Any, Dict, List, Optional
from dynamo_db import dynamodb_service, USE_DYNAMODB

DB_PATH = os.path.join(os.path.dirname(__file__), "sydliving.db")

class DatabaseRepository:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_property(self, property_id: str) -> Optional[Dict[str, Any]]:
        if USE_DYNAMODB and dynamodb_service.is_connected:
            return dynamodb_service.get_property(property_id)

        if not os.path.exists(self.db_path):
            return None

        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM properties WHERE id = ?", (property_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def query_properties(
        self,
        suburb: Optional[str] = None,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        if USE_DYNAMODB and dynamodb_service.is_connected:
            return dynamodb_service.query_properties(suburb, max_rent, min_bedrooms)

        if not os.path.exists(self.db_path):
            return []

        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            query = "SELECT * FROM properties WHERE 1=1"
            params = []
            if suburb and suburb != "":
                query += " AND suburb = ?"
                params.append(suburb)
            if max_rent is not None and max_rent < 99999.0:
                query += " AND weekly_rent <= ?"
                params.append(max_rent)
            if min_bedrooms is not None and min_bedrooms > 0:
                query += " AND bedrooms >= ?"
                params.append(min_bedrooms)

            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_commute(self, origin: str, dest: str) -> Optional[Dict[str, Any]]:
        if USE_DYNAMODB and dynamodb_service.is_connected:
            return dynamodb_service.get_commute(origin, dest)

        if not os.path.exists(self.db_path):
            return None

        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM commute_matrix WHERE origin_suburb = ? AND destination_cbd_hub = ?",
                (origin, dest)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

db_repository = DatabaseRepository()
