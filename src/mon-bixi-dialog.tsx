import { MutableRefObject, useRef, useState } from "react";
import { useRideStoreTx } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, StatsDetail } from "./stats";


export function MonBixiDialog() {
    const dialogRef: MutableRefObject<HTMLDialogElement | null> = useRef(null)
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<StatsDetail>();

    useRideStoreTx(async (db) => {
        setLoading(true)
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)
        setLoading(false)
        setStats((stats) => ({ ...stats, ...freshStats.stats }))
    })

    useOpenMonBixi(() => {
        dialogRef.current?.showModal()
    });

    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            {stats && (
                <div>
                    <h1>Nombres de trajets cette année: {stats.rideCountYearly}</h1>
                    <h1>Total d'heures à vélo cette année: {stats.totalHoursYearly}h</h1>
                    <h1>Station la plus utilisée: {stats.mostUsedStation}</h1>
                    <h1>Distance totale estimée: {stats.totalDistanceYearly}km</h1>
                    <h1>Quartier favori: {stats.mostVisitedBorough}</h1>
                </div>
            )}
        </dialog>
    );
}
