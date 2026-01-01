import { useEffect, useRef, useState } from "react";
import { useIndexDb } from "../data/indexdb";
import { useOpenMonBixi } from "../extension";
import classes from "../extension.module.css";
import { fetchRidesAsNeeded } from "../data/import-bixi-stats";
import { getOrComputeStats, StatsDetail } from "../data/compute-stats";
import { StoriesSlideshow, useStoriesSlideshow } from "./stories";
import { Stage } from "react-konva";
import { StoryContent } from "./story-content";

function Loading({ isLoading }: { isLoading: boolean }) {
    return isLoading && <div className={classes.loadingIndicator}>Analyse de vos déplacements...</div>
}

export function MonBixiDialog({ year }: { year: number }) {
    const [{ clientWidth, clientHeight }, setClientSize] = useState({ clientWidth: 0, clientHeight: 0 })
    const dialogRef = useRef<HTMLDialogElement>(null)

    const observer = useRef(new ResizeObserver(() => {
        if (!dialogRef.current) return
        const { clientWidth, clientHeight } = dialogRef.current
        setClientSize({ clientWidth, clientHeight })
    }))

    useEffect(() => {
        if (!dialogRef.current) return
        dialogRef.current.addEventListener("close", () => setOpen(false))
        observer.current.observe(dialogRef.current)
    })

    const [open, setOpen] = useState(false)
    const [stats, setStats] = useState<StatsDetail>();
    const { setPlaying, ...storiesProps } = useStoriesSlideshow({ duration: 5_000, pageCount: 3 })

    useIndexDb(async (db) => {
        await fetchRidesAsNeeded(db, year)
        const freshStats = await getOrComputeStats(db, year)
        setStats(freshStats.stats)
    })

    useOpenMonBixi(() => {
        dialogRef.current?.showModal()
        setOpen(true)
    });

    useEffect(() => {
        if (stats) setPlaying(open)
    }, [open, stats])


    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            {stats && <StoriesSlideshow {...storiesProps}>
                <Stage width={clientWidth} height={clientHeight} scale={{ x: clientWidth / 100, y: clientWidth / 100 }}>
                    <StoryContent width={100} height={clientHeight * 100 / clientWidth} stats={stats} />
                </Stage>
            </StoriesSlideshow>}
            <Loading isLoading={stats === undefined} />
        </dialog>
    );
}
