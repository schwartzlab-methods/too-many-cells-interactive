#! /usr/bin/env python3

import asyncio
import csv
import logging
from os import path, walk, environ
from shutil import copyfile
from typing import List, Dict, Any
import time

from motor import motor_asyncio

client = motor_asyncio.AsyncIOMotorClient(environ.get("MONGO_CONNECTION_STRING"))
db = client[environ.get("MONGO_DB")]
features_collection = db.features

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(message)s')
ch.setFormatter(formatter)
logger.addHandler(ch)



async def insert_many(docs: List[Dict[Any, Any]]):
    await features_collection.insert_many(docs)


async def bootstrap():
    await features_collection.drop()


start = time.perf_counter()


async def parse_matrices(root_dir: str):
    for root, dirs, files in walk(root_dir):
        if (
            "matrix.mtx" in files
            and "barcodes.tsv" in files
            and ("genes.tsv" in files or "features.tsv" in files)
        ):
            with open(path.join(root, "matrix.mtx")) as f:
                logger.info(f"loading {root}")
                feature_file = "genes.tsv" if "genes.tsv" in files else "features.tsv"
                features_path = path.join(root, feature_file)
                feature_ids = {
                    i
                    + 1: {
                        "feature": row[0],
                        "feature_type": row[1]
                        if row[1] and row[1] != row[0]
                        else "Gene Expression",
                    }
                    for i, row in enumerate(
                        csv.reader(open(features_path, mode="rt"), delimiter="\t")
                    )
                }
                barcodes_path = path.join(root, "barcodes.tsv")
                barcodes = {
                    i + 1: row[0]
                    for i, row in enumerate(
                        csv.reader(open(barcodes_path, mode="rt"), delimiter="\n")
                    )
                }
                i = 0
                chunk = []
                #skip headers
                [f.readline() for i in range(2)]
                for line in f:
                    feature_idx, barcode_idx, value = line.split(" ")
                    chunk.append(
                        {
                            "feature": feature_ids[int(feature_idx)]["feature"],
                            "feature_type": feature_ids[int(feature_idx)]["feature_type"],
                            "id": barcodes[int(barcode_idx)],
                            "value": int(value),
                        }
                    )
                    i+=1
                    if i == 100000:  # 100k
                        await insert_many(chunk)
                        i = 0
                        chunk = []
                #insert remaining rows
                await insert_many(chunk)

        if "cluster_tree.json" in files:
            copyfile(
                path.join(root, "cluster_tree.json"),
                "/usr/app/static/files/cluster_tree.json",
            )

        if "labels.csv" in files:
            copyfile(path.join(root, "labels.csv"), "/usr/app/static/files/labels.csv")

async def insert_features():
    await bootstrap()
    await parse_matrices("/usr/data")
    logger.info("building index...")
    await features_collection.create_index("feature")
    logger.info(f"finished import in {time.perf_counter() - start} seconds")


if __name__ == "__main__":
    asyncio.run(insert_features())
