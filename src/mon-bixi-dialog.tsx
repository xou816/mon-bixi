import { MutableRefObject, useRef, useState } from "react";
import { useRideStoreTx } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, getStat } from "./stats";


export function MonBixiDialog() {
    const dialogRef: MutableRefObject<HTMLDialogElement | null> = useRef(null)
    const [stats, setStats] = useState({
        rideCountYearly: 0,
        totalHoursYearly: 0,
        mostUsedStation: "?",
        totalDistanceYearly: 0,
        mostVisitedBorough: "?"
    });

    useRideStoreTx(async (db) => {
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)
        for (const name of Object.keys(stats)) {
            setStats((stats) => ({ ...stats, [name]: getStat(freshStats, name)}))
        }
    })

    useOpenMonBixi(async () => {
        dialogRef.current?.showModal()
    });

    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            <h1>Nombres de trajets cette année: {stats.rideCountYearly}</h1>
            <h1>Total d'heures à vélo cette année: {stats.totalHoursYearly}h</h1>
            <h1>Station la plus utilisée: {stats.mostUsedStation}</h1>
            <h1>Distance totale estimée: {stats.totalDistanceYearly}km</h1>
            <h1>Quartier favori: {stats.mostVisitedBorough}</h1>
        </dialog>
    );
}
