import { useEffect, useRef, useState } from "react";
import { useIndexDb } from "../data/indexdb";
import { useOpenMonBixi } from "../extension";
import classes from "../extension.module.css";
import { getLastStats, getUpdatedStats, StatsDetail } from "../data/compute-stats";
import { StoriesSlideshow, useStoriesSlideshow } from "./stories";
import { Stage } from "react-konva";
import { StoryContent } from "./story-content";

function Loading({ loadingProgress }: { loadingProgress: number }) {
    return loadingProgress < 100 && <div className={classes.loadingIndicator}>Analyse de vos déplacements... {loadingProgress}%</div>
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
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [stats, setStats] = useState<StatsDetail>();
    const { setPlaying, ...storiesProps } = useStoriesSlideshow({ duration: 5_000, pageCount: 3 })

    useIndexDb(async (db) => {
        const oldStats = await getLastStats(db, year)
        if (oldStats) setStats(oldStats.stats)

        const latestStats = getUpdatedStats(db, year)
        let done = false
        while (!done) {
            const next = await latestStats.next();
            done = next.done ?? true
            if (next.done) {
                setLoadingProgress(100)
                setStats(next.value.stats)
            } else {
                setLoadingProgress(Math.floor(next.value * 100))
            }
        }
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
            {!stats && <Loading loadingProgress={loadingProgress} />}
        </dialog>
    );
}
