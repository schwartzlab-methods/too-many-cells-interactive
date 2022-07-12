#! /usr/bin/env python3

import asyncio
import csv
import gzip
import logging
from dataclasses import dataclass
from os import path, walk, environ
import re
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


@dataclass
class FileSet:
    matrix_files: bool = False
    tree: bool = False
    labels: bool = False

    def all_found(self):
        return self.matrix_files and self.tree and self.labels

    def __str__(self):
        if self.all_found():
            pass
        else:
            missing = ''
            if not self.matrix_files:
                missing += " \nMatrix files (features.tsv or genes.tsv, barcodes.tsv, matrix.mtx, all in one directory or subdirectory). Do they need to be extracted?"
            if not self.tree:
                missing += " \ncluster_tree.json"
            if not self.labels:
                missing += "\nlabels.csv"

            return f"The import script failed to find the following files in the data directory: {missing}"


async def insert_many(docs: List[Dict[Any, Any]]):
    await features_collection.insert_many(docs)


async def bootstrap():
    await features_collection.drop()


start = time.perf_counter()


ex = re.compile(r"^(features\.tsv|genes\.tsv|barcodes\.tsv|matrix\.mtx)(\.gz)?$")
async def contains_matrix_files(files: List[str]):
    """ returns true if matrix files exist in file list """
    return len(set([f for f in files if ex.match(f)])) == 3

async def check_for_files(root_dir: str):
    """ this will run contains_files and die once everything is found """
    results = FileSet()
    for root, dirs, files in walk(root_dir):
        if await contains_matrix_files(files):
            results.matrix_files = True

        if "cluster_tree.json" in files:
            results.tree = True

        if "labels.csv" in files:
            results.labels = True

        if results.all_found():
            break

    if results.all_found():
        return True
    else:
        raise FileNotFoundError(results)

async def open_maybe_compressed(pathname: str):
    if pathname.endswith('.gz'):
        return gzip.open(pathname,  mode="rt")
    else:
        return open(pathname,  mode="rt")


async def parse_matrices(root_dir: str):
    for root, dirs, files in walk(root_dir):
        if await contains_matrix_files(files):
            matrix_file = next(f for f in files if re.match(r"^matrix.mtx",f))
            with await open_maybe_compressed(path.join(root, matrix_file)) as f:
                logger.info(f"loading {root}")
                feature_file = next(f for f in files if re.match(r"^(features|genes).tsv",f))
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
                        csv.reader(await open_maybe_compressed(features_path), delimiter="\t")
                    )
                }
                barcodes_file = feature_file = next(f for f in files if re.match(r"^barcodes.tsv",f))
                barcodes_path = path.join(root, barcodes_file)
                barcodes = {
                    i + 1: row[0]
                    for i, row in enumerate(
                        csv.reader(await open_maybe_compressed(barcodes_path), delimiter="\n")
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
    logger.info("checking that required files are in the data directory...")
    await check_for_files("/usr/data")
    logger.info("importing files into mongo...")
    await parse_matrices("/usr/data")
    logger.info("building index...")
    await features_collection.create_index("feature")
    logger.info(f"finished import in {time.perf_counter() - start} seconds")


if __name__ == "__main__":
    asyncio.run(insert_features())
