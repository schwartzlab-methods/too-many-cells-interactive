import { opendir } from 'fs/promises';
import { createGunzip } from 'zlib';
import { existsSync, createReadStream } from 'fs';
import path from 'path';

import split2 from 'split2';
import yargs from 'yargs';
import { Pool } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

interface Feature {
    feature: string;
    feature_type: string;
}

const argv = yargs(process.argv.slice(2))
    .option('debug', {
        describe: 'Provide verbose output',
    })
    .help().argv as Record<string, string>;

const DEBUG = !!argv.debug;

const CHUNK_SIZE = 100000;

const debug = (msg: string) => {
    if (argv.debug) {
        console.debug(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
};

const getPool = async (remainingTries = 5) => {
    let client;
    let pool;
    try {
        pool = new Pool();
        client = await pool.connect();
    } catch (e) {
        console.error(e);
        if (remainingTries) {
            await new Promise(resolve =>
                setTimeout(() => resolve(getPool(remainingTries - 1)), 1000)
            );
        } else {
            throw 'Could not connect to database!';
        }
    } finally {
        client?.release();
    }
    return pool as Pool;
};

const verifyMatrixFilesPresent = async (rootDir: string) => {
    const missingFiles = {
        matrixFiles: 'matrix files not found',
    } as Partial<Record<string, string>>;

    for await (const filelist of walkTree(rootDir)) {
        if (containsMatrixFiles(filelist)) {
            delete missingFiles.matrixFiles;
        }
    }

    if (Object.values(missingFiles).length) {
        throw Object.values(missingFiles).join('\n');
    }
};

const truncateDatabase = async (pool: Pool) => {
    const client = await pool.connect();
    await client.query('TRUNCATE features;');
    await client.query('DROP INDEX IF EXISTS feature_idx;');
    client.release();
};

const createIndex = async (pool: Pool) => {
    const client = await pool.connect();
    await client.query(
        'CREATE INDEX IF NOT EXISTS feature_idx ON features (feature);'
    );
    client.release();
};

const insertMany = async (chunk: string, pool: Pool) => {
    const query = 'COPY features (id, feature, feature_type, value) FROM STDIN';

    const client = await pool.connect();

    const stream = client.query(copyFrom(query));

    stream.write(Buffer.from(chunk), err => {
        if (err) {
            console.error(err);
        }
        stream.end();
    });

    return new Promise((resolve, reject) => {
        stream.on('error', e => {
            client.release();
            reject(e);
        });
        stream.on('finish', e => {
            client.release();
            resolve(true);
            stream.destroy();
        });
    });
};

/**
 *
 * @param filepath Path to features file
 * @returns A dictionary of features keyed by index for fast lookup
 */
const getFeaturesDict = async (filepath: string) => {
    const ret = {} as Record<string, Feature>;
    let i = 1;
    await parseFile(filepath, async row => {
        const vals = row.split('\t');
        ret[i] = {
            feature: vals[0],
            feature_type:
                vals.length > 1 && vals[1] != vals[0]
                    ? vals[1]
                    : 'Gene Expression',
        };
        i++;
    });

    return ret;
};

/**
 *
 * @param filepath Path to barcode file
 * @returns A dictionary of barcodes keyed by index for fast lookup
 */
const getBarcodesDict = async (filepath: string) => {
    const ret = {} as Record<string, string>;
    let i = 1;
    await parseFile(filepath, async row => {
        ret[i] = row.split('\t')[0];
        i++;
    });

    return ret;
};

/**
 *
 * @param filepath Location of file to open
 * @param cb callback to fire on 'data' event
 * @returns Promise<boolean>
 */
const parseFile = async (
    filepath: string,
    cb: (line: string) => Promise<void>
): Promise<boolean> =>
    new Promise(async (resolve, reject) => {
        const rl = openMaybeCompressed(filepath);

        rl.on('data', async line => {
            rl.pause();
            await cb(line);
            rl.resume();
        })
            .on('finish', () => {
                resolve(true);
            })
            .on('error', e => {
                reject(e);
            });
    });

/**
 * Open a read stream and pipe to split2 in order to read line-by-line
 *
 * @param filepath Path of the file to open
 * @returns Transform
 */
const openMaybeCompressed = (filepath: string) => {
    return filepath.endsWith('gz')
        ? createReadStream(filepath).pipe(createGunzip()).pipe(split2())
        : createReadStream(filepath).pipe(split2());
};

/**
 * Import the matrix by reading row by row and attaching values from barcodes and features files
 *
 * @param barcodes Dictionary of barcodes by index
 * @param features Dictionary of features by index
 * @param matrixFilepath Path to matrix
 * @param lineCount Optional line count for debugging
 * @returns
 */
const insertMatrix = async (
    pool: Pool,
    barcodes: Record<string, string>,
    features: Record<string, Feature>,
    matrixFilepath: string,
    lineCount?: number
) => {
    let i = 0;
    let j = 0;
    let chunk = '';
    await parseFile(matrixFilepath, async line => {
        //skip headers
        if (i < 3 && j === 0) {
            i++;
            return;
        }
        const [featureIdx, barcodeIdx, value] = line.split(' ');

        chunk += `${barcodes[barcodeIdx]}\t${features[featureIdx].feature}\t${features[featureIdx].feature_type}\t${value}\n`;

        i++;
        if (i === CHUNK_SIZE) {
            if (lineCount) {
                debug(
                    `Inserting chunk ${j} (${(
                        (((j + 1) * CHUNK_SIZE) / lineCount) *
                        100
                    ).toFixed(2)}%)`
                );
            }

            await insertMany(chunk, pool);
            debug(`Chunk ${j} inserted.`);
            i = 0;
            j++;
            chunk = '';
        }
    });
    await insertMany(chunk, pool);

    return true;
};

const countLines = async (filepath: string): Promise<number> => {
    let count = 0;
    await parseFile(filepath, async () => {
        count++;
    });

    return count;
};

/* Walk the tree, yielding full contents of each directory */
async function* walkTree(root: string): AsyncGenerator<string[], any, any> {
    const files = [] as string[];
    const dirs = [] as string[];
    for await (const d of await opendir(root)) {
        const entry = path.join(root, d.name);
        if (d.isDirectory()) {
            dirs.push(entry);
        } else if (d.isFile()) {
            files.push(entry);
        }
    }

    yield files;
    if (dirs.length) {
        for (const dir of dirs) {
            yield* walkTree(dir);
        }
    }
}

const mtxRegex = /(features\.tsv|genes\.tsv|barcodes\.tsv|matrix\.mtx)(\.gz)?$/;

const containsMatrixFiles = (files: string[]) =>
    files.filter(f => mtxRegex.test(f)).length === 3;

const importData = async (rootDir: string, pool: Pool) => {
    if (!existsSync(rootDir) || !path.isAbsolute(rootDir)) {
        throw `${rootDir} does not exist! Is the path absolute?`;
    }

    for await (const filelist of walkTree(rootDir)) {
        if (containsMatrixFiles(filelist)) {
            const matrixFile = filelist.find(f =>
                f.match(/matrix\.mtx(\.gz)?$/)
            )!;
            let lineCount;
            if (DEBUG) {
                lineCount = await countLines(matrixFile);
                debug(`Inserting ${lineCount} rows from ${matrixFile}`);
            }

            const featureFile = filelist.find(f =>
                /(features|genes)\.tsv(\.gz)?$/.test(f)
            )!;

            const features = await getFeaturesDict(featureFile);

            const barcodesFile = filelist.find(f =>
                /barcodes.tsv(\.gz)?$/.test(f)
            )!;

            const barcodes = await getBarcodesDict(barcodesFile);

            await insertMatrix(pool, barcodes, features, matrixFile, lineCount);
        }
    }
};

/**
 * Import files into postgres.
 *  Note that the files are expected to be located in the `/usr/data` directory.
 *  As this script is expected to be executed as part of a `docker run` command, the user should
 *  bind-mount the needed files into the /usr/data directory.
 */
const run = async () => {
    const dataDir = '/usr/data';
    const pool = await getPool();
    console.log('Data import started');
    debug('verifying data');
    await verifyMatrixFilesPresent(dataDir);
    debug('truncating database');
    await truncateDatabase(pool);
    debug('uploading files');
    const start = new Date().getTime();
    await importData(dataDir, pool);
    debug('creating index');
    await createIndex(pool);
    const end = new Date().getTime();
    console.log(`finished in ${(end - start) / 1000} seconds`);
};

run();
