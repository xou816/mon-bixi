import { DbHandle, STATS_STORE } from "./indexdb";
import { yearBounds } from "./import-bixi-stats";
import { Location, Ride } from "./gql-queries";
import { detailedStations } from "./data.compile";

const EARTH_RADIUS = 6161e3
const haversineDeg = (theta: number) => Math.sin(rad(theta) / 2) ** 2
const rad = (theta: number) => theta / 180 * Math.PI
const cosDeg = (theta: number) => Math.cos(rad(theta))

function sphericalDist(a: Location, b: Location): Dimen<"m"> {
    const h = haversineDeg(b.lat - a.lat) + cosDeg(a.lat) * cosDeg(b.lat) * haversineDeg(b.lon - a.lon)
    return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(h)) as Dimen<"m">
}

type FreqTable = { [k: string]: number } & { _mostFrequent: string }

function frequencyTable<T>(data: T[], categorize: (t: T) => string[]): FreqTable {
    return data.reduce((freqTable, t) => {
        const categorized = new Set(categorize(t))
        for (const cat of categorized) {
            freqTable[cat] = 1 + (freqTable[cat] ?? 0)
            const c = freqTable[freqTable._mostFrequent] ?? 0
            freqTable._mostFrequent = freqTable[cat] > c ? cat : freqTable._mostFrequent
        }
        return freqTable
    }, {} as FreqTable)
}

function average<T>(series: T[], valuePath: (t: T) => number) {
    return series.reduce((avg, t) => avg + valuePath(t) * 1 / series.length, 0)
}

// inneficient but will do for now
function findClosestStation(loc: Location, radius: number = 300) {
    return Object.values(detailedStations)
        .reduce((acc, { name, arrondissement, ...s }, i) => {
            if (acc) return acc
            const distance = sphericalDist(s, loc)
            return distance < radius ? { name, distance, arrondissement } : null;
        }, null as { name: string, arrondissement: string, distance: number } | null)
}

function findBoroughForStation(station: string, loc: Location, radius: number = 300): string {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lat, lon }, loc)
        if (dist < radius)
            return detailedStations[station].arrondissement
    }
    const closest = findClosestStation(loc)
    return closest?.arrondissement ?? "Inconnu"
}

function fixStationName(station: string, loc: Location, radius: number = 500) {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lon, lat }, loc)
        if (dist < radius) return station
    }

    const found = findClosestStation(loc, radius)
    // a pseudo hash to keep them "unique"
    const id = (1e6 * (loc.lat + loc.lon)).toString().substring(3, 7)

    console.warn(`${station} is probably wrong, found close station ${found?.name} in ${found?.arrondissement}`)
    if (found) return `Station inconnue #${id} (${found?.arrondissement})`
    return `Station inconnue`
}

function computeAllRidesPhysicalStats(rides: Ride[]) {
    const all = rides.map((ride) => computePhysicalStats(ride)).filter((it) => it !== null)
    const avgSpeed = average(all, t => t.speed)
    return all.map((stats) => {
        const { distance, duration } = stats
        if (distance === 0) {
            return {
                distance: 0.75 * avgSpeed * duration as Dimen<"m">,
                speed: avgSpeed as Dimen<"m/s">,
                duration: duration as Dimen<"s">,
            }
        } else {
            return stats
        }
    })
}

function computePhysicalStats(ride: Ride) {
    const { startAddressStr, endAddressStr, startAddress, endAddress, startTimeMs, endTimeMs } = ride

    let distance: Dimen<"m"> = 0 as Dimen<"m">
    if (startAddressStr !== endAddressStr) {
        const midPoint = { ...startAddress, lat: endAddress.lat }
        distance = (sphericalDist(startAddress, midPoint)
            + sphericalDist(midPoint, endAddress)) as Dimen<"m">
    }

    let duration = ((parseInt(endTimeMs, 10) - parseInt(startTimeMs, 10)) / 1000) as Dimen<"s">
    if (Number.isNaN(duration)) {
        console.warn("Ride is problematic", ride)
        return null
    }

    const speed = distance / duration as Dimen<"m/s">
    return { distance, duration, speed }
}

export async function getOrComputeStats(db: DbHandle, year: number): Promise<Stats> {
    const [startOfYear, endOfYear] = yearBounds(year)
    const rides = await db.findRides()
        .filterKeys(IDBKeyRange.bound(startOfYear, endOfYear))
        .descKeys()
        .get()
    const timeMs = rides[rides.length - 1]?.startTimeMs ?? 0

    let stats = await db.findStats().getKey(timeMs)
    // if (stats) return stats

    const s = {
        year,
        rideCountYearly: rides.length,
        rideTimeAndDist: computeAllRidesPhysicalStats(rides),
        mostUsedStations: frequencyTable(rides, ({ startAddressStr, startAddress, endAddressStr, endAddress }) => [
            fixStationName(startAddressStr, startAddress),
            fixStationName(endAddressStr, endAddress)
        ]),
        mostVisitedBoroughs: frequencyTable(rides, ({ startAddressStr, startAddress, endAddressStr, endAddress }) => [
            findBoroughForStation(startAddressStr, startAddress),
            findBoroughForStation(endAddressStr, endAddress)
        ])
    }

    const { _mostFrequent: mostVisitedBorough, ...mostVisitedBoroughs } = s.mostVisitedBoroughs
    const { _mostFrequent: mostUsedStation, ...mostUsedStations } = s.mostUsedStations
    const s2 = {
        ...s,
        totalHoursYearly: Math.floor(s.rideTimeAndDist.reduce((sum, { duration }) => sum + duration, 0) / 3600),
        mostUsedStation,
        mostUsedStations,
        totalDistanceYearly: Math.floor(1e-3 * s.rideTimeAndDist.reduce((sum, { distance }) => sum + distance, 0)),
        mostVisitedBorough,
        mostVisitedBoroughs,
        averageRideTime: average(s.rideTimeAndDist, t => t.duration) as Dimen<"s">
    }

    stats = { timeMs, stats: s2 }
    const tx = await db.createTx(STATS_STORE, "readwrite")
    tx.put(stats)
    return stats
}

type Unit = "m" | "s" | "m/s"
type Dimen<T extends Unit> = number & { readonly __unit: T };

export type StatsDetail = {
    year: number,
    rideCountYearly: number,
    rideTimeAndDist: { distance: Dimen<"m">, speed: Dimen<"m/s">, duration: Dimen<"s"> }[],
    averageRideTime: Dimen<"s">,
    mostUsedStations: { [k: string]: number },
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
