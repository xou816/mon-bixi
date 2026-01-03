import stations from './stations.json' // from https://gbfs.velobixi.com/gbfs/fr/station_information.json
import arrondissementsGeojson from './arrondissements.json' // from https://donnees.montreal.ca/fr/dataset/limites-administratives-agglomeration
import montrealGeojson from './limites-terrestres.json' // from https://www.donneesquebec.ca/recherche/dataset/vmtl-limites-terrestres/resource/92cb062a-11be-4222-9ea5-867e7e64c5ff
import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Shape, Vector2, Vector3 } from "three"
import simplify from "simplify-js"

export type Station = {
    name: string,
    lat: number,
    lon: number
}

export type EnrichedStation = Station & { arrondissement: string }

function boundingBox(poly: { x: number; y: number; }[]) {
    const xs = poly.map(({ x }) => x);
    const ys = poly.map(({ y }) => y);
    const minMax = (vs: number[]) => vs.reduce(
        ({ min, max }, v) => ({ min: Math.min(min, v), max: Math.max(max, v) }),
        { min: Infinity, max: -Infinity });
    const mx = minMax(xs);
    const my = minMax(ys);
    return {
        minX: mx.min, maxX: mx.max,
        minY: my.min, maxY: my.max,
        width: mx.max - mx.min, height: my.max - my.min
    };
}

export type BBox = ReturnType<typeof boundingBox>

function computeArrondissementsMeshes() {
    return arrondissementsGeojson.features.map(({ properties, geometry }) => {
        if (geometry.type !== "MultiPolygon") throw new Error()
        const polys = geometry.coordinates
        if (polys.length > 1) console.log(`Warning: ${properties.NOM} has multiple polys!`)
        const simplePolys = polys.map((poly) => {
            const [exterior, ...holes] = poly
            if (holes.length > 0) console.log(`Warning: ${properties.NOM} has holes!`)
            return simplify(exterior.map(([x, y]) => ({ x, y })), 1e-3)
        })
        const meshes = simplePolys.map((poly) => {
            const shape = new Shape(poly.map(({ x, y }) => new Vector2(x, y)))
            const geometry = new ExtrudeGeometry(shape, { bevelEnabled: false });
            geometry.computeBoundingBox()
            return new Mesh(geometry, new MeshBasicMaterial())
        })
        return { name: properties.NOM, meshes, simplePolys }
    })
}

const arrondissementsMeshes = computeArrondissementsMeshes()
export const arrondissementPolys = arrondissementsMeshes.map(({ name, simplePolys }) => ({ name, simplePolys }))

function computeMontealPolys() {
    return montrealGeojson.features
        .map(({ geometry }) => {
            if (geometry.type !== "MultiPolygon") throw new Error()
            const poly = geometry.coordinates[0]
            const [exterior, ...holes] = poly
            const extPoly = exterior.map(([x, y]) => ({ x, y }))
            const bbox = boundingBox(extPoly)
            const area = (bbox.maxY - bbox.minY) * (bbox.maxX - bbox.minX)
            return { poly: extPoly, area }
        })
        .filter(({ area }) =>  area > 1e-4)
        .map(({ poly }) => simplify(poly, 2e-3))
        .sort((a, b) => b.length - a.length)
}

export const montrealPolys = computeMontealPolys()
export const montrealBbox = boundingBox(montrealPolys[0])
console.log(`Montreal with ${montrealPolys.length} polys, largest: ${montrealPolys[0].length} vertices`)

function enrichStation(station: Station): EnrichedStation {
    const { lon, lat } = station
    const origin = new Vector3(lon, lat, 10)
    const raycaster = new Raycaster(origin, new Vector3(0, 0, -1))

    const matched = arrondissementsMeshes.find(({ meshes }) => meshes.some((mesh) => {
        if (mesh.geometry.boundingBox?.containsPoint(new Vector3(lon, lat, 0)) === false) return false
        const res = raycaster.intersectObject(mesh)
        return res.length > 0
    }))

    return {
        name: station.name,
        lat: station.lat,
        lon: station.lon,
        arrondissement: matched?.name ?? "Inconnu"
    }
}

export const detailedStations: { [k: string]: EnrichedStation } = stations.data.stations
    .reduce((acc, station) => ({ ...acc, [station.name]: enrichStation(station) }), {})