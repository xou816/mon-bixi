import { DbHandle, findRides, findStats, Stats, STATS_STORE } from "./db";
import { END_OF_YEAR, START_OF_YEAR } from "./import";

export async function getOrComputeStats(db: DbHandle): Promise<Stats> {
    const rides = await findRides(db)
        .filterKeys(IDBKeyRange.bound(START_OF_YEAR, END_OF_YEAR))
        .descKeys()
        .get()
    const timeMs = rides[rides.length - 1]?.startTimeMs ?? 0

    let stats = await findStats(db).filterKeys(IDBKeyRange.only(timeMs)).getOne()
    // if (stats) return stats

    stats = {
        timeMs,
        stats: [
            {
                name: "rideCountYearly",
                value: rides.length
            },
            {
                name: "totalHoursYearly",
                value: (() => {
                    const totalMs = rides.reduce((acc, { startTimeMs, endTimeMs }) => acc + parseInt(endTimeMs, 10) - parseInt(startTimeMs, 10), 0)
                    return Math.floor(totalMs / 1000 / 3600)
                })()
            },
            {
                name: "mostUsedStation",
                value: (() => {
                    const stationsUsed = rides.reduce((stations, { startAddressStr, endAddressStr }) => {
                        const c0 = stations[stations._mostFrequent] ?? -1
                        const c1 = stations[startAddressStr] ?? 0 + 1
                        const c2 = stations[endAddressStr] ?? 0 + 1
                        stations._mostFrequent = c1 > c0 && c1 >= c2 ? startAddressStr : c2 > c0 ? endAddressStr : stations._mostFrequent
                        return { ...stations, [startAddressStr]: c1, [endAddressStr]: c2 }
                    }, {} as { [k: string]: number } & { _mostFrequent: string })
                    return stationsUsed._mostFrequent
                })()
            }
        ]
    }

    const tx = await db.createTx(STATS_STORE, "readwrite")
    tx.put(stats)
    return stats
}

export function getStat<T = unknown>(stats: Stats, statName: string): T | undefined {
    return stats.stats.find(({ name }) => name === statName)?.value
}