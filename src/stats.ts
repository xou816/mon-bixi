import { DbHandle, STATS_STORE } from "./db";
import { END_OF_YEAR, START_OF_YEAR } from "./import";
import { Location } from "./queries";
import { boroughPerStation } from "./data/data.compile";

const EARTH_RADIUS = 6161e3
const haversineDeg = (theta: number) => Math.sin(rad(theta) / 2) ** 2
const rad = (theta: number) => theta / 180 * Math.PI
const cosDeg = (theta: number) => Math.cos(rad(theta))

function sphericalDist(a: Location, b: Location): number {
    const h = haversineDeg(b.lat - a.lat) + cosDeg(a.lat) * cosDeg(b.lat) * haversineDeg(b.lng - a.lng)
    return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(h))
}

type FreqTable = { [k: string]: number } & { _mostFrequent: string }

function frequencyTable<T>(data: T[], categorize: (t: T) => string[]): FreqTable {
    return data.reduce((freqTable, t) => {
        const categorized = categorize(t)
        for (const cat of categorized) {
            freqTable[cat] = 1 + (freqTable[cat] ?? 0)
            const c = freqTable[freqTable._mostFrequent] ?? 0
            freqTable._mostFrequent = freqTable[cat] > c ? cat : freqTable._mostFrequent
        }
        return freqTable
    }, {} as FreqTable)
}

export async function getOrComputeStats(db: DbHandle): Promise<Stats> {
    const rides = await db.findRides()
        .filterKeys(IDBKeyRange.bound(START_OF_YEAR, END_OF_YEAR))
        .descKeys()
        .get()
    const timeMs = rides[rides.length - 1]?.startTimeMs ?? 0

    let stats = await db.findStats().getKey(timeMs)
    // if (stats) return stats

    const s = {
        rideCountYearly: rides.length,
        rideTimeMs: rides.map(({ startTimeMs, endTimeMs }) => parseInt(endTimeMs, 10) - parseInt(startTimeMs, 10)),
        mostUsedStations: frequencyTable(rides, ({ startAddressStr, endAddressStr }) => [startAddressStr, endAddressStr]),
        rideEstimatedDistance: rides.map(({ startAddress, endAddress }) => (
            sphericalDist(startAddress, { ...startAddress, lat: endAddress.lat })
            + sphericalDist({ ...startAddress, lat: endAddress.lat }, endAddress))),
        mostVisitedBoroughs: frequencyTable(rides, ({ startAddressStr, endAddressStr }) => [
            boroughPerStation[startAddressStr] ?? "Inconnu",
            boroughPerStation[endAddressStr] ?? "Inconnu"
        ])
    }

    const s2 = {
        ...s,
        totalHoursYearly: Math.floor(s.rideTimeMs.reduce((sum, timeMs) => sum + timeMs, 0) / 1000 / 3600),
        mostUsedStation: s.mostUsedStations._mostFrequent,
        totalDistanceYearly: Math.floor(1e-3 * s.rideEstimatedDistance.reduce((sum, dist) => sum + dist, 0)),
        mostVisitedBorough: s.mostVisitedBoroughs._mostFrequent
    }

    stats = { timeMs, stats: s2 }
    const tx = await db.createTx(STATS_STORE, "readwrite")
    tx.put(stats)
    return stats
}

export type StatsDetail = {
    rideCountYearly: number,
    rideTimeMs: number[],
    mostUsedStations: { [k: string]: number },
    rideEstimatedDistance: number[],
    mostVisitedBoroughs: { [k: string]: number }
    totalHoursYearly: number,
    mostUsedStation: string,
    totalDistanceYearly: number,
    mostVisitedBorough: string,
    [key: string]: unknown
}

export type Stats = {
    timeMs: string;
    stats: StatsDetail
};
