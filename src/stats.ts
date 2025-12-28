import { DbHandle, findRides, findStats, Stats, STATS_STORE } from "./db";
import { END_OF_YEAR, START_OF_YEAR } from "./import";
import { Location } from "./queries";
import { allStations } from "./data/data.compile";

const EARTH_RADIUS = 6161e3
const haversineDeg = (theta: number) => Math.sin(rad(theta) / 2) ** 2
const rad = (theta: number) => theta / 180 * Math.PI
const cosDeg = (theta: number) => Math.cos(rad(theta))

function sphericalDist(a: Location, b: Location): number {
    const h = haversineDeg(b.lat - a.lat) + cosDeg(a.lat) * cosDeg(b.lat) * haversineDeg(b.lng - a.lng)
    return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(h))
}

export async function getOrComputeStats(db: DbHandle): Promise<Stats> {
    const rides = await findRides(db)
        .filterKeys(IDBKeyRange.bound(START_OF_YEAR, END_OF_YEAR))
        .descKeys()
        .get()
    const timeMs = rides[rides.length - 1]?.startTimeMs ?? 0

    let stats = await findStats(db).getKey(timeMs)
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
                        const c1 = (stations[startAddressStr] ?? 0) + 1
                        const c2 = (stations[endAddressStr] ?? 0) + 1
                        stations._mostFrequent = c1 > c0 && c1 >= c2 ? startAddressStr : c2 > c0 ? endAddressStr : stations._mostFrequent
                        return { ...stations, [startAddressStr]: c1, [endAddressStr]: c2 }
                    }, {} as { [k: string]: number } & { _mostFrequent: string })
                    return stationsUsed._mostFrequent
                })()
            },
            {
                name: "totalDistanceYearly",
                value: (() => {
                    const dist = rides.reduce((acc, { startAddress, endAddress }) => {
                        const d = sphericalDist(startAddress, { ...startAddress, lat: endAddress.lat })
                            + sphericalDist({ ...startAddress, lat: endAddress.lat }, endAddress);
                        return acc + d
                    }, 0)
                    return Math.floor(dist / 1e3)
                })()
            },
            {
                name: "mostVisitedBorough", 
                value: (() => {
                    const mostVisited = rides.reduce((acc, { startAddressStr, endAddressStr }) => {
                        const c0 = acc[acc._mostFrequent] ?? -1
                        const b1 = allStations[startAddressStr]?.arrondissement ?? ""
                        const c1 = (acc[b1] ?? 0) + 1
                        const b2 = allStations[endAddressStr]?.arrondissement ?? ""
                        const c2 = (acc[b2] ?? 0) + 1
                        acc._mostFrequent =  c1 > c0 && c1 >= c2 ? b1 : c2 > c0 ? b2 : acc._mostFrequent
                        return {
                            ...acc,
                            [b1]: c1,
                            [b2]: c2
                        }
                    }, {} as {[k: string]: number} & { _mostFrequent: string })
                    return mostVisited._mostFrequent
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