import { DbHandle, STATS_STORE } from "./indexdb";
import { yearBounds } from "./import-bixi-stats";
import { Location, Ride } from "./gql-queries";
import { detailedStations } from "./data.compile";

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
        const categorized = new Set(categorize(t))
        for (const cat of categorized) {
            freqTable[cat] = 1 + (freqTable[cat] ?? 0)
            const c = freqTable[freqTable._mostFrequent] ?? 0
            freqTable._mostFrequent = freqTable[cat] > c ? cat : freqTable._mostFrequent
        }
        return freqTable
    }, {} as FreqTable)
}

// inneficient but will do for now
function findClosestStation(loc: Location, radius: number = 300) {
    return Object.values(detailedStations)
        .reduce((acc, { name, arrondissement, ...s }, i) => {
            if (acc) return acc
            const distance = sphericalDist({ lat: s.lon, lng: s.lat }, loc)
            return distance < radius ? { name, distance, arrondissement } : null;
        }, null as { name: string, arrondissement: string, distance: number } | null)
}

function findBoroughForStation(station: string, loc: Location, radius: number = 300): string {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lat, lng: lon }, { lat: loc.lng ?? 0, lng: loc.lat ?? 0 })
        if (dist < radius)
            return detailedStations[station].arrondissement
    }
    const closest = findClosestStation(loc)
    return closest?.arrondissement ?? "Inconnu"
}

function fixStationName(station: string, loc: Location, radius: number = 500) {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lng: lon, lat }, { lat: loc.lng ?? 0, lng: loc.lat ?? 0 })
        if (dist < radius) return station
    }

    const found = findClosestStation(loc, radius)
    // a pseudo hash to keep them "unique"
    const id = (1e6 * (loc.lat + loc.lng)).toString().substring(3, 7)

    console.warn(`${station} is probably wrong, found close station ${found?.name} in ${found?.arrondissement}`)
    if (found) return `Station inconnue #${id} (${found?.arrondissement})`
    return `Station inconnue`
}

function computeAllRidesPhysicalStats(rides: Ride[]) {
    const all = rides.map((ride) => computePhysicalStats(ride)).filter((it) => it !== null)
    const avgSpeed = all.reduce((avg, { speed }) => avg + speed * 1 / all.length, 0)
    return all.map((stats) => {
        const { distance, duration } = stats
        if (distance === 0) {
            return {
                distance: 0.75 * avgSpeed * duration,
                speed: avgSpeed,
                duration,
            }
        } else {
            return stats
        }
    })
}

function computePhysicalStats(ride: Ride) {
    const { startAddressStr, endAddressStr, startAddress, endAddress, startTimeMs, endTimeMs } = ride

    let distance = 0
    if (startAddressStr !== endAddressStr) {
        const midPoint = { ...startAddress, lat: endAddress.lat }
        distance = sphericalDist(startAddress, midPoint)
            + sphericalDist(midPoint, endAddress)
    }

    let duration = (parseInt(endTimeMs, 10) - parseInt(startTimeMs, 10)) / 1000
    if (Number.isNaN(duration)) {
        console.warn("Ride is problematic", ride)
        return null
    }

    const speed = distance / duration
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
        averageRideTimeMs: s.rideTimeAndDist.reduce((avg, { duration }) => avg + duration * 1 / s.rideTimeAndDist.length, 0)
    }

    stats = { timeMs, stats: s2 }
    const tx = await db.createTx(STATS_STORE, "readwrite")
    tx.put(stats)
    return stats
}

export type StatsDetail = {
    year: number,
    rideCountYearly: number,
    rideTimeAndDist: { distance: number, speed: number, duration: number }[],
    averageRideTimeMs: number,
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
