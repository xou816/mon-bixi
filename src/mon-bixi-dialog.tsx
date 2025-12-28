import { MutableRefObject, useRef, useState } from "react";
import { useOpenMonBixi } from "./extension";
import { queryStats } from "./queries";
import classes from "./extension.module.css";

export function MonBixiDialog() {
    const dialogRef: MutableRefObject<HTMLDialogElement | null> = useRef(null)
    const [rides, setRides] = useState(-1);

    useOpenMonBixi(async () => {
        dialogRef.current?.showModal()
        if (rides !== -1) return;
        const stats = await queryStats();
        setRides(stats.data.member.stats.numberOfRides);
    }, [rides]);

    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            <h1>Nombres de trajets: {rides}</h1>
        </dialog>
    );
}
