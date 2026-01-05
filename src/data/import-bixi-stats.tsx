import { DbHandle, RIDES_STORE } from "./indexdb";
import { queryHistory, Ride } from "./gql-queries";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const yearBounds = (year: number) => [
    Date.parse(`${year}-01-01T00:00:00Z`).toString(),
    Date.parse(`${year + 1}-01-01T00:00:00Z`).toString()
] as [string, string]

const getLastRides = (offset: number) => queryHistory(offset).then(({ data }) => ({
    rides: data.member.rideHistory.rideHistoryList,
    hasMore: data.member.rideHistory.hasMore
}))

type BatchInfo = { rides: Ride[], hasMore: boolean, oldestRideMs: string, newestRideMs: string }

// fetches as many rides as needed and saves them to IndexedDB
// yields the progress as a value between 0 and 1
async function* fetchBatches(
    db: DbHandle,
    startOffset: number,
    continueIf: (cur: BatchInfo) => boolean,
    startOfYear: string, endOfYear: string) {

    let offset = startOffset
    let cur = { rides: new Array<Ride>(), hasMore: true }
    let sleepTime = 500

    const startOfYearInt = parseInt(startOfYear, 10)
    let firstRideTs: number | undefined

    do {
        try {
            cur = await getLastRides(offset)
            const tx = await db.createTx(RIDES_STORE, "readwrite")
            for (const ride of cur.rides) {
                if (firstRideTs === undefined)
                    firstRideTs = parseInt(ride.startTimeMs, 10)
                if (ride.startTimeMs < endOfYear)
                    tx.add(ride)
            }

            const lastRideTs = parseInt(cur.rides[cur.rides.length - 1].startTimeMs, 10)
            if (!firstRideTs) {
                yield 0
            } else {
                const progress = 1 - Math.max(0, lastRideTs - startOfYearInt) / (firstRideTs - startOfYearInt)
                yield progress
            }

            offset += 10
        } catch (e) {
            sleepTime *= 2
            console.warn(`Error fetching rides... retrying in a moment`)
        }

        await sleep(sleepTime)
    } while (continueIf({
        ...cur,
        oldestRideMs: cur.rides[cur.rides.length - 1].startTimeMs,
        newestRideMs: cur.rides[0].startTimeMs
    }))
}

// fetches as many rides as needed and saves them to IndexedDB
// yields the progress as a value between 0 and 1
export async function* fetchRidesAsNeeded(db: DbHandle, year: number) {
    const [startOfYear, endOfYear] = yearBounds(year)
    const [lastRide, oldestRide, count] = await Promise.all([
        db.findRides().filterKeys(IDBKeyRange.lowerBound(startOfYear)).descKeys().getOne(),
        db.findRides().filterKeys(IDBKeyRange.upperBound(endOfYear)).ascKeys().getOne(),
        db.findRides().filterKeys(IDBKeyRange.bound(startOfYear, endOfYear)).count(),
    ]);
    const lastRideMs = lastRide?.startTimeMs ?? 0;
    const oldestRideMs = oldestRide?.startTimeMs ?? 0;

    yield* fetchBatches(db,
        0,
        ({ hasMore, newestRideMs }) => newestRideMs > lastRideMs && hasMore && newestRideMs >= startOfYear,
        startOfYear, endOfYear);

    if (oldestRideMs <= startOfYear) return;

    yield* fetchBatches(db,
        count - count % 10,
        ({ oldestRideMs }) => oldestRideMs > startOfYear,
        startOfYear, endOfYear);
}
