import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRideStoreTx } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, StatsDetail } from "./stats";
import { Stories, useStoriesSlideshow } from "./stories";

const StatsContext = createContext<StatsDetail>({} as StatsDetail)
export const useStats = () => useContext(StatsContext)

function HomeStory() {
    return <h1>Mon année avec Bixi</h1>
}

function HoursStory() {
    const { totalHoursYearly } = useStats()
    return (
        <>
            <h1>{totalHoursYearly} heures !</h1>
            <p>C'est votre temps passé sur un Bixi au total en 2025.</p>
        </>
    )
}

export function MonBixiDialog() {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [open, setOpen] = useState(false)
    const [stats, setStats] = useState<StatsDetail>({} as StatsDetail);

    const duration = 5_000
    const { setPlaying, ...storiesProps } = useStoriesSlideshow({
        duration,
        pages: [
            { id: "home", render: HomeStory },
            { id: "hours", render: HoursStory }
        ]
    })

    useRideStoreTx(async (db) => {
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)
        setStats((stats) => ({ ...stats, ...freshStats.stats }))
    })

    useOpenMonBixi(() => {
        dialogRef.current?.showModal()
        setOpen(true)
    });

    useEffect(() => {
        if (stats != undefined && open) setPlaying(true)
    }, [open, stats])


    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            <StatsContext.Provider value={stats}>
                <Stories {...storiesProps} duration={duration} />
            </StatsContext.Provider>
        </dialog>
    );
}
