#! /usr/bin/env python3

import asyncio
import csv
from os import path, walk, environ
from shutil import copyfile
from typing import List, Dict, Any
import time

from motor import motor_asyncio

client = motor_asyncio.AsyncIOMotorClient(environ.get("MONGO_CONNECTION_STRING"))
db = client[environ.get("MONGO_DB")]
features_collection = db.features

""" Note that motor claims it will automatically optimize chunk size """
async def insert_many(docs: List[Dict[Any, Any]]):
    await features_collection.insert_many(docs)


async def bootstrap():
    await features_collection.drop() 
    await features_collection.create_index("feature")


start = time.perf_counter()
tasks = []
async def parse_matrices(root_dir: str):
    for root, dirs, files in walk(root_dir):
        if('matrix.mtx' in files and 'barcodes.tsv' in files and ('genes.tsv' in files or 'features.tsv' in files)):
            with open(path.join(root, 'matrix.mtx')) as f:
                print(f"loading {root}")
                feature_file = 'genes.tsv' if 'genes.tsv' in files else 'features.tsv'
                features_path = path.join(root, feature_file)
                feature_ids = {i + 1 : { "feature":  row[0], "feature_type": row[1] if row[1] and row[1] != row[0] else "Gene Expression"} for i, row in enumerate(csv.reader(open(features_path, mode="rt"), delimiter="\t"))}
                barcodes_path = path.join(root, "barcodes.tsv")
                barcodes = { i + 1 : row[0] for i, row in enumerate(csv.reader(open(barcodes_path, mode="rt"), delimiter="\n"))}
                i = -1
                chunk = []
                for line in f:
                    i+=1
                    #skip headers
                    if i < 3:
                        continue
                    feature_idx, barcode_idx, value = line.split(" ")
                    chunk.append({"feature": feature_ids[int(feature_idx)]['feature'], 'feature_type':  feature_ids[int(feature_idx)], "id": barcodes[int(barcode_idx)], "value": int(value)})   
                    if i == 100000: # 100k
                        await insert_many(chunk)
                        i = 0
                        chunk = []

        if "cluster_tree.json" in files:
            copyfile(path.join(root, "cluster_tree.json"), "/usr/app/static/files/cluster_tree.json")

        if "labels.csv" in files:
            copyfile(path.join(root, "labels.csv"), "/usr/app/static/files/labels.csv")
    
    
    print(f"finished import in {time.perf_counter() - start} seconds")
    #1396 secs (23 minutes) w/ 10k chunk size and no task parallelization
    #1396 secs w/ 100k chunk size at 117million rows... so no difference there

    #it seems that these concurrent writes aren't very effective or much faster (in fact, much slower...)
    # but first make sure we've got a lock problem to begin with: https://www.mongodb.com/docs/manual/faq/concurrency
    # in particular this table, which suggests a lock on writes, but use the cli tools to check what locks are there and then see if you can break them....
    # not clear from the serverStatus() output, but in htop you can see the processes queued up -- probably the overhead slows things down
        # yup, housing all that data in memory is using up a lot of RAM
        # better to just enlarge chunk size and see
    #could try:
    # 1. sharding (overkill)
    # 2. chunking in 1gbs and passing it all to write_many (use a generator rather than asyncio)
    #     - nope, the max batch size is 100k
    #     - basically already doing that....
    # is writing the damned csv faster....?



async def insert_features():
    await bootstrap()
    await parse_matrices("/usr/data")

if(__name__ == "__main__"):
    asyncio.run(insert_features())

