import { useEffect } from "react";
import { Ride } from "./queries";

export const RIDES_STORE = "rides";
export const STATS_STORE = "stats"
const DB_VERSION = 2;

function migrateDatabase(db: IDBDatabase, event: IDBVersionChangeEvent): Promise<void> {
    return new Promise((resolve) => {
        const newVersion = event.newVersion ?? 1
        if (newVersion >= 1 && event.oldVersion !== 1) {
            const objectStore = db.createObjectStore(RIDES_STORE, { keyPath: "startTimeMs" });
            objectStore.transaction.oncomplete = () => resolve()
        }
        if (newVersion >= 2 && event.oldVersion !== 2) {
            const objectStore = db.createObjectStore(STATS_STORE, { keyPath: "timeMs" });
            objectStore.transaction.oncomplete = () => resolve()
        }
    })
}

function getResult<T>(event: Event) {
    const cast = event.target as unknown as { result: T };
    return cast.result
}

async function getDb() {
    const { resolve, reject, promise } = Promise.withResolvers<IDBDatabase>()

    const request = indexedDB.open("monbixi", DB_VERSION);

    request.onupgradeneeded = async (event) => {
        if (!event.target) return
        const db = getResult<IDBDatabase>(event);
        await migrateDatabase(db, event)
        resolve(db)
    }

    request.onerror = () => reject()

    request.onsuccess = (event) => {
        if (!event.target) return
        const db = getResult<IDBDatabase>(event);
        resolve(db)
    }

    return promise
}

async function getStore(store: string, mode: IDBTransactionMode) {
    const db = await getDb()
    const tx = db.transaction(store, mode)
    return tx.objectStore(store)
}

export type DbHandle = {
    createRidesTx: (mode: IDBTransactionMode) => Promise<IDBObjectStore>
    createTx: (store: string, mode: IDBTransactionMode) => Promise<IDBObjectStore>
}

export function useRideStoreTx(callback: (h: DbHandle) => void) {
    useEffect(() => {
        callback({
            createRidesTx: (mode) => getStore(RIDES_STORE, mode),
            createTx: (store, mode) => getStore(store, mode)
        })
    }, [])
}

class IndexDBQuery<R> {
    private _filter: (ride: R) => boolean = () => true
    private _range?: IDBKeyRange
    private _order?: IDBCursorDirection
    private _limit = 1e9

    constructor(private db: DbHandle, private store: string) { }

    filter(f: typeof this._filter) {
        this._filter = f
        return this
    }

    filterKeys(r: IDBKeyRange) {
        this._range = r
        return this
    }

    async getKey(key: unknown) {
        return this.filterKeys(IDBKeyRange.only(key)).getOne()
    }

    descKeys() {
        this._order = "prevunique"
        return this
    }

    ascKeys() {
        this._order = "nextunique"
        return this
    }

    limit(n: number) {
        this._limit = n
        return this
    }

    async getOne(): Promise<R | undefined> {
        const res = await this.limit(1).get()
        return res[0]
    }

    async count(): Promise<number> {
        const res = await this.get()
        return res.length
    }

    async get(): Promise<R[]> {
        const { resolve, promise } = Promise.withResolvers<R[]>()
        const results: R[] = []
        const tx = await this.db.createTx(this.store,"readonly")
        tx.openCursor(this._range, this._order).onsuccess = (event) => {
            const cursor = getResult<IDBCursorWithValue | null>(event)
            if (cursor && this._filter(cursor.value) && results.length < this._limit)
                results.push(cursor.value)

            if (!cursor || results.length >= this._limit) {
                resolve(results)
            } else {
                cursor.continue()
            }
        }
        return promise
    }
}

export type Stats = {
    timeMs: string,
    stats: {
        name: string,
        value: any
    }[]
}

export const findRides = (db: DbHandle) => new IndexDBQuery<Ride>(db, RIDES_STORE)
export const findStats = (db: DbHandle) => new IndexDBQuery<Stats>(db, STATS_STORE)