#! /usr/bin/env python3

import asyncio
import csv
from os import path, walk, environ
from shutil import copyfile
from typing import List, Dict, Any
import time

from motor import motor_asyncio

client = motor_asyncio.AsyncIOMotorClient(environ.get("MONGO_CONNECTION_STRING"))
db = client.test
test_collection = db.features

""" Note that motor claims it will automatically optimize chunk size """
async def insert_many(docs: List[Dict[Any, Any]]):
    await test_collection.insert_many(docs)


async def bootstrap():
    await test_collection.drop() 
    await test_collection.create_index("feature")


start = time.perf_counter()

async def insert_test_data():
       
    
    print(f"finished import in {time.perf_counter() - start} seconds")
    #1396 secs (23 minutes) w/ 10k chunk size and no task parallelization



async def insert_features():
    await bootstrap()
    await insert_test_data()

if(__name__ == "__main__"):
    asyncio.run(insert_features())

