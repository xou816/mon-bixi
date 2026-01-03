import { DbHandle, STATS_STORE } from "./indexdb";
import { fetchRidesAsNeeded, yearBounds } from "./import-bixi-stats";
import { Location, Ride } from "./gql-queries";
import { detailedStations, EnrichedStation, montrealBbox } from "./data.compile";
import { Box, Circle, Point, QuadTree } from "js-quadtree";
import { distance } from "fastest-levenshtein"

const EARTH_RADIUS = 6161e3
const haversineDeg = (theta: number) => Math.sin(rad(theta) / 2) ** 2
const rad = (theta: number) => theta / 180 * Math.PI
const deg = (theta: number) => theta / Math.PI * 180
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

function average<T, U extends Unit>(series: T[], valuePath: (t: T) => Dimen<U>) {
    return sum(series, valuePath) * 1 / series.length as Dimen<U>
}

function sum<T, U extends Unit>(series: T[], valuePath: (t: T) => Dimen<U>) {
    return series.reduce((sum, t) => sum + valuePath(t), 0) as Dimen<U>
}

function fillQuadTree() {
    const { minX, minY, width, height } = montrealBbox
    const box = new Box(minX, minY, width, height)
    const tree = new QuadTree(box)
    for (const station of Object.values(detailedStations)) {
        tree.insert(new Point(station.lon, station.lat, station))
    }
    return tree
}

const montrealTree = fillQuadTree()

function findClosestStation(loc: Location, radius: number) {
    const res = montrealTree.query(new Circle(loc.lon, loc.lat, deg(radius / EARTH_RADIUS)))
    return res[0]?.data as EnrichedStation | undefined
}

function findBoroughForStation(station: string, loc: Location, radius: number = 300): string {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lat, lon }, loc)
        if (dist < radius)
            return detailedStations[station].arrondissement
    }
    const closest = findClosestStation(loc, radius)
    return closest?.arrondissement ?? "Inconnu"
}

function fixStationName(station: string, loc: Location, radius: number = 300) {
    if (detailedStations[station]) {
        const { lat, lon } = detailedStations[station]
        const dist = sphericalDist({ lon, lat }, loc)
        if (dist < radius) return station
    }

    const found = findClosestStation(loc, radius)
    // a pseudo hash to keep them "unique"
    const id = (1e6 * (loc.lat + loc.lon)).toString().substring(3, 7)

    if (found) {
        console.info(`${station} is probably wrong, but found close station ${found.name} in ${found.arrondissement}`)
        return distance(station, found.name) < 5 ? found.name : `Station inconnue #${id} (${found.arrondissement})`
    } else {
        console.warn(`${station} is probably wrong`)
    }
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
                speed: avgSpeed,
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

function countWinterRides(rides: Ride[], year: number) {
    const start = Date.parse(`${year}-11-16T00:00:00Z`).toString()
    const end = Date.parse(`${year}-04-14T23:59:59Z`).toString()
    return rides.reduce((sum, ride) => sum + Number(ride.startTimeMs > start || ride.startTimeMs < end), 0)
}

export async function getLastStats(db: DbHandle, year: number): Promise<Stats | undefined> {
    const [startOfYear, endOfYear] = yearBounds(year)
    let stats = await db.findStats()
        .filterKeys(IDBKeyRange.bound(startOfYear, endOfYear))
        .descKeys()
        .getOne()
    return stats
}

export async function* getUpdatedStats(db: DbHandle, year: number): AsyncGenerator<number, Stats, void> {

    for await (const progress of fetchRidesAsNeeded(db, year)) {
        yield progress
    }

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
        ]),
        winterRides: countWinterRides(rides, year)
    }

    const { _mostFrequent: mostVisitedBorough, ...mostVisitedBoroughs } = s.mostVisitedBoroughs
    const { _mostFrequent: mostUsedStation, ...mostUsedStations } = s.mostUsedStations
    const s2 = {
        ...s,
        totalTimeYearly: sum(s.rideTimeAndDist, t => t.duration),
        mostUsedStation,
        mostUsedStations,
        totalDistanceYearly: sum(s.rideTimeAndDist, t => t.distance),
        mostVisitedBorough,
        mostVisitedBoroughs,
        averageRideTime: average(s.rideTimeAndDist, t => t.duration),
        averageRideDist: average(s.rideTimeAndDist, t => t.distance)
    }

    stats = { timeMs, stats: s2 }
    const tx = await db.createTx(STATS_STORE, "readwrite")
    tx.put(stats)

    yield 1

    return stats
}

// for documentation purposes, mostly :)
type Unit = "m" | "s" | "m/s"
type Dimen<T extends Unit> = number & { readonly __unit: T };

export type StatsDetail = {
    year: number,
    rideCountYearly: number,
    rideTimeAndDist: { distance: Dimen<"m">, speed: Dimen<"m/s">, duration: Dimen<"s"> }[],
    averageRideTime: Dimen<"s">,
    averageRideDist: Dimen<"m">,
    mostUsedStations: { [k: string]: number },
    mostVisitedBoroughs: { [k: string]: number }
    totalTimeYearly: Dimen<"s">,
    mostUsedStation: string,
    totalDistanceYearly: Dimen<"m">,
    mostVisitedBorough: string,
    winterRides: number,
}

export type Stats = {
    timeMs: string;
    stats: StatsDetail
};
