import { DbHandle, RIDES_STORE } from "./db";
import { queryHistory, Ride } from "./queries";

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

async function fetchBatches(db: DbHandle, startOffset: number, continueIf: (cur: BatchInfo) => boolean, endOfYear: string) {
    let offset = startOffset
    let cur = { rides: new Array<Ride>(), hasMore: true }
    do {
        cur = await getLastRides(offset)
        const tx = await db.createTx(RIDES_STORE, "readwrite")
        for (const ride of cur.rides) {
            if (ride.startTimeMs < endOfYear)
                tx.add(ride)
        }

        offset += 10
        await sleep(500)
    } while (continueIf({
        ...cur,
        oldestRideMs: cur.rides[cur.rides.length - 1].startTimeMs,
        newestRideMs: cur.rides[0].startTimeMs
    }))
}

export async function fetchRidesAsNeeded(db: DbHandle, year: number) {
    const [startOfYear, endOfYear] = yearBounds(year)
    const [lastRide, oldestRide, count] = await Promise.all([
        db.findRides().filterKeys(IDBKeyRange.lowerBound(startOfYear)).descKeys().getOne(),
        db.findRides().filterKeys(IDBKeyRange.upperBound(endOfYear)).ascKeys().getOne(),
        db.findRides().filterKeys(IDBKeyRange.bound(startOfYear, endOfYear)).count(),
    ]);
    const lastRideMs = lastRide?.startTimeMs ?? 0;
    const oldestRideMs = oldestRide?.startTimeMs ?? 0;

    // return

    await fetchBatches(db, 0, ({ hasMore, newestRideMs }) => newestRideMs > lastRideMs && hasMore && newestRideMs >= startOfYear, endOfYear);

    if (oldestRideMs <= startOfYear) return;
    await fetchBatches(db, count - count % 10, ({ oldestRideMs }) => oldestRideMs > startOfYear, endOfYear);
}
