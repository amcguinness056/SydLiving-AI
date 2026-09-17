"""
DynamoDB Single-Table Seeding Script for SydLivingAI
===================================================
Seeds the `SydLiving-Core` DynamoDB table with initial Sydney rental properties
and CBD commute matrices.

Usage:
  python seed_dynamodb.py [--create-table] [--endpoint-url http://localhost:8000]
"""

import os
import sys
import argparse
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "SydLiving-Core")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")

def create_single_table_if_not_exists(dynamodb, table_name=TABLE_NAME):
    """Creates the SydLiving-Core single table with PK, SK, and GSI1 if absent."""
    try:
        table = dynamodb.Table(table_name)
        table.load()
        print(f"Table '{table_name}' already exists.")
        return table
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            print(f"Creating DynamoDB table '{table_name}' with On-Demand capacity...")
            table = dynamodb.create_table(
                TableName=table_name,
                KeySchema=[
                    {"AttributeName": "PK", "KeyType": "HASH"},
                    {"AttributeName": "SK", "KeyType": "RANGE"}
                ],
                AttributeDefinitions=[
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                    {"AttributeName": "GSI1PK", "AttributeType": "S"},
                    {"AttributeName": "GSI1SK", "AttributeType": "S"}
                ],
                GlobalSecondaryIndexes=[
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
                        ],
                        "Projection": {"ProjectionType": "ALL"}
                    }
                ],
                BillingMode="PAY_PER_REQUEST"
            )
            table.wait_until_exists()
            print(f"Table '{table_name}' created successfully!")
            return table
        else:
            raise

def seed_dynamodb(table):
    print(f"Seeding '{table.name}' with Sydney rental properties and commute itineraries...")

    suburbs = {
        "Coogee": {"lat": -33.923, "lon": 151.253, "beach_dist": 0.5},
        "Bondi": {"lat": -33.891, "lon": 151.276, "beach_dist": 0.3},
        "Newtown": {"lat": -33.897, "lon": 151.178, "beach_dist": 7.0},
        "Surry Hills": {"lat": -33.883, "lon": 151.214, "beach_dist": 4.0},
        "Manly": {"lat": -33.796, "lon": 151.282, "beach_dist": 0.2},
        "Parramatta": {"lat": -33.815, "lon": 151.001, "beach_dist": 25.0},
        "Chatswood": {"lat": -33.798, "lon": 151.183, "beach_dist": 10.0}
    }

    cbd_hubs = ["Barangaroo", "Martin Place", "Central", "Town Hall", "Wynyard"]
    transit_modes = ["Train", "Bus", "Ferry", "Light Rail", "Metro"]
    adjectives = ["Spacious", "Sunny", "Modern", "Cozy", "Luxury", "Quiet", "Charming"]
    types = ["Apartment", "Sharehouse", "Studio", "Terrace", "House"]

    with table.batch_writer() as batch:
        # Seed Properties
        for _ in range(50):
            suburb = random.choice(list(suburbs.keys()))
            data = suburbs[suburb]
            bed = random.randint(1, 5)
            bath = random.randint(1, max(1, bed - 1))
            base_rent = bed * 350
            rent_modifier = random.uniform(0.8, 1.5)
            weekly_rent = round(base_rent * rent_modifier / 10) * 10
            prop_id = str(uuid.uuid4())
            title = f"{random.choice(adjectives)} {bed}BR {random.choice(types)} in {suburb}"
            address = f"{random.randint(1, 200)} Fake Street, {suburb}, NSW"
            lat = round(data["lat"] + random.uniform(-0.005, 0.005), 6)
            lon = round(data["lon"] + random.uniform(-0.005, 0.005), 6)
            beach_dist = round(max(0.1, data["beach_dist"] + random.uniform(-0.2, 0.5)), 2)
            avail_date = (datetime.now() + timedelta(days=random.randint(0, 30))).strftime('%Y-%m-%d')

            item = {
                "PK": f"PROP#{prop_id}",
                "SK": "METADATA",
                "GSI1PK": f"SUBURB#{suburb}",
                "GSI1SK": f"RENT#{weekly_rent:08.2f}",
                "entity_type": "PROPERTY",
                "id": prop_id,
                "title": title,
                "suburb": suburb,
                "bedrooms": bed,
                "bathrooms": bath,
                "weekly_rent": Decimal(str(weekly_rent)),
                "address": address,
                "latitude": Decimal(str(lat)),
                "longitude": Decimal(str(lon)),
                "distance_to_beach_km": Decimal(str(beach_dist)),
                "available_date": avail_date,
                "is_domain_data": False
            }
            batch.put_item(Item=item)

        # Seed Commute Matrix
        for origin in suburbs.keys():
            for dest in cbd_hubs:
                if origin in ["Coogee", "Bondi"] and dest in ["Barangaroo", "Martin Place", "Wynyard"]:
                    duration = random.randint(30, 45)
                    mode = "Bus"
                elif origin in ["Newtown", "Surry Hills"]:
                    duration = random.randint(10, 25)
                    mode = "Train"
                elif origin == "Manly" and dest in ["Barangaroo", "Wynyard"]:
                    duration = random.randint(25, 35)
                    mode = "Ferry"
                elif origin in ["Parramatta", "Chatswood"]:
                    duration = random.randint(20, 35)
                    mode = "Train" if origin == "Parramatta" else "Metro"
                else:
                    duration = random.randint(15, 50)
                    mode = random.choice(transit_modes)

                freq = random.choice([5, 10, 15, 20])
                commute_item = {
                    "PK": f"COMMUTE#{origin}",
                    "SK": f"DEST#{dest}",
                    "entity_type": "COMMUTE",
                    "origin_suburb": origin,
                    "destination_cbd_hub": dest,
                    "transit_mode": mode,
                    "duration_minutes": duration,
                    "peak_frequency_mins": freq
                }
                batch.put_item(Item=commute_item)

    print("Successfully seeded DynamoDB table!")

def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB Single Table for SydLivingAI")
    parser.add_argument("--create-table", action="store_true", help="Create DynamoDB table if absent")
    parser.add_argument("--endpoint-url", type=str, default=None, help="Custom DynamoDB endpoint (e.g. LocalStack or dynamodb-local)")
    parser.add_argument("--table-name", type=str, default=TABLE_NAME, help="Target DynamoDB table name")
    args = parser.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION, endpoint_url=args.endpoint_url)

    if args.create_table:
        table = create_single_table_if_not_exists(dynamodb, args.table_name)
    else:
        table = dynamodb.Table(args.table_name)

    seed_dynamodb(table)

if __name__ == "__main__":
    main()
