import arrondissements from './arrondissements.json'
import stations from './stations.json'
import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Shape, Vector2, Vector3 } from "three"

type Station = {
    stationName: string,
    location: {
        lat: number,
        lng: number
    }
}

function computeArrondissementsMeshes() {
    return arrondissements.features.map(({ properties, geometry }) => {
        if (geometry.type !== "MultiPolygon") throw new Error()
        const polys = geometry.coordinates.map(poly => poly[0])
        const meshes = polys.map((poly) => {
            const shape = new Shape(poly.map(([x, y]) => new Vector2(x, y)))
            const geometry = new ExtrudeGeometry(shape, { bevelEnabled: false });
            geometry.computeBoundingBox()
            return new Mesh(geometry, new MeshBasicMaterial())
        })
        return { name: properties.NOM, meshes }
    })
}

const arrondissementsMeshes = computeArrondissementsMeshes()

function enrichStation(station: Station): Station & { arrondissement: string } {
    const { lng, lat } = station.location
    const origin = new Vector3(lng, lat, 10)
    const raycaster = new Raycaster(origin, new Vector3(0, 0, -1))

    const matched = arrondissementsMeshes.find(({ name, meshes }) => {
        return meshes.some((mesh) => {
            if (mesh.geometry.boundingBox?.containsPoint(new Vector3(lng, lat, 0)) === false) return false
            const res = raycaster.intersectObject(mesh)
            return res[0] !== undefined
        })
    })
    // console.log(matched?.name)
    return {
        stationName: station.stationName,
        location: station.location,
        arrondissement: matched?.name ?? ""
    }
}

export const allStations: { [k: string]: Station & { arrondissement: string } } = stations.data.supply.stations
    .reduce((acc, station) => ({ ...acc, [station.stationName]: enrichStation(station) }), {})