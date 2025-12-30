import { useEffect, useRef, useState } from "react";
import { useIndexDb } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, StatsDetail } from "./stats";
import { StoriesSlideshow, useStories, useStoriesSlideshow } from "./stories";
import { Stage } from "react-konva";
import { MonBixiStory } from "./story-content";

function StartButton() {
    const { playing, activePage } = useStories()
    const visible = !playing && activePage === 0
    return visible && <button className={classes.startButton}>C'est parti !</button>
}

export function MonBixiDialog() {
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
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)
        setStats((stats) => ({ ...stats, ...freshStats.stats }))
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
            <StoriesSlideshow {...storiesProps}>
                <Stage width={clientWidth} height={clientHeight} scale={{ x: clientWidth / 100, y: clientWidth / 100 }}>
                    <MonBixiStory stats={stats ?? {} as StatsDetail} />
                </Stage>
                {/* <StartButton /> */}
            </StoriesSlideshow>
        </dialog>
    );
}
