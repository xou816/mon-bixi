import { DbHandle, findRides, RIDES_STORE } from "./db";
import { queryHistory, Ride } from "./queries";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const START_OF_YEAR = Date.parse("2025-01-01T00:00:00Z").toString();
export const END_OF_YEAR = Date.parse("2026-01-01T00:00:00Z").toString();

const getLastRides = (offset: number) => queryHistory(offset).then(({ data }) => ({
    rides: data.member.rideHistory.rideHistoryList,
    hasMore: data.member.rideHistory.hasMore
}))

type BatchInfo = { rides: Ride[], hasMore: boolean, oldestRideMs: string, newestRideMs: string }

async function fetchBatches(db: DbHandle, startOffset: number, continueIf: (cur: BatchInfo) => boolean) {
    let offset = startOffset
    let cur = { rides: new Array<Ride>(), hasMore: true }
    do {
        cur = await getLastRides(offset)
        const tx = await db.createTx(RIDES_STORE, "readwrite")
        for (const ride of cur.rides) {
            if (ride.startTimeMs < END_OF_YEAR)
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

export async function fetchRidesAsNeeded(db: DbHandle) {
    const [lastRide, oldestRide, count] = await Promise.all([
        findRides(db).descKeys().getOne(),
        findRides(db).ascKeys().getOne(),
        findRides(db).count(),
    ]);
    const lastRideMs = lastRide?.startTimeMs ?? 0;
    const oldestRideMs = oldestRide?.startTimeMs ?? 0;

    return

    await fetchBatches(db, 0, ({ hasMore, newestRideMs }) => newestRideMs > lastRideMs && hasMore && newestRideMs >= START_OF_YEAR);

    if (oldestRideMs <= START_OF_YEAR) return;
    await fetchBatches(db, count - count % 10, ({ oldestRideMs }) => oldestRideMs > START_OF_YEAR);
}
