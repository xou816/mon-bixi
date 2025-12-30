import arrondissements from './arrondissements.json' // from https://donnees.montreal.ca/fr/dataset/limites-administratives-agglomeration
import stations from './stations.json' // from https://gbfs.velobixi.com/gbfs/fr/station_information.json
import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Shape, Vector2, Vector3 } from "three"
import simplify from "simplify-js"

type Station = {
    name: string,
    lat: number,
    lon: number
}

type EnrichedStation = Station & { arrondissement: string }

function computeArrondissementsMeshes() {
    return arrondissements.features.map(({ properties, geometry }) => {
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

export const boroughPerStation: { [k: string]: string } = stations.data.stations
    .reduce((acc, station) => ({ ...acc, [station.name]: enrichStation(station).arrondissement }), {})