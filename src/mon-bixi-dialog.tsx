import { act, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRideStoreTx } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, StatsDetail } from "./stats";

type TimeoutData = {
    timeout: ReturnType<typeof setTimeout> | undefined,
    latest: number | undefined, // latest date recorded when entering playing state
    elapsed: number // elapsed time, computed when pausing
}

function useStoriesTimer({ pageCount, duration }: { pageCount: number, duration: number }) {
    const [{ playing, activePage }, setPlayState] = useState({
        activePage: -1,
        playing: false,
    })

    const setPlaying = (playing: boolean) => setPlayState((s) => ({ ...s, playing, activePage: Math.max(s.activePage, 0) }))
    const setPage = (page: number) => setPlayState((s) => ({ ...s, playing: true, activePage: Math.min(page, pageCount - 1) }))
    const nextPage = () => setPlayState((s) => ({ ...s, playing: true, activePage: Math.min(s.activePage + 1, pageCount - 1) }))
    const togglePlaying = () => setPlayState((s) => ({ ...s, playing: !s.playing, activePage: Math.max(s.activePage, 0) }))

    const timeoutData = useRef<{ [k: number]: TimeoutData }>({})

    useEffect(() => {
        // clear timeouts on previously visited pages
        for (const [pageIndex, data] of Object.entries(timeoutData.current)) {
            const index = parseInt(pageIndex)
            if (index !== activePage && data.timeout) {
                clearTimeout(data.timeout)
            }
        }

        const cur = document.timeline.currentTime as number
        let { latest, elapsed, timeout } = timeoutData.current[activePage] ?? { latest: undefined, elapsed: 0 }

        if (playing && activePage <= pageCount - 1) {
            if (!timeout) {
                // console.log(`Running for ${duration - elapsed}ms`)
                timeout = setTimeout(() => nextPage(), duration - elapsed)
            }
            timeoutData.current = {
                [activePage]: {
                    latest: latest ?? cur,
                    elapsed,
                    timeout
                }
            }
        } else {
            clearTimeout(timeout)
            timeoutData.current = {
                [activePage]: {
                    latest: undefined,
                    elapsed: latest !== undefined ? cur - (latest ?? 0) + elapsed : elapsed,
                    timeout: undefined
                }
            }
        }
    }, [[playing, activePage]])

    return { playing, activePage, setPlaying, setPage, togglePlaying }
}

const asClassName = (classTab: { [k: string]: boolean }) => Object.entries(classTab).reduce((str, [klass, active]) => `${str} ${active ? klass : ""}`.trimEnd(), "")

type StoriesProps = {
    playing: boolean,
    activePage: number,
    duration: number,
    setPage: (p: number) => void,
    togglePlaying: () => void
}

function Stories({ playing, activePage, duration, setPage, togglePlaying }: StoriesProps) {
    type CSSStoryProperties = { "--stepperTiming": string } & CSSProperties
    const stepperStyle = useMemo(() => ({ "--stepperTiming": `${duration}ms` } as CSSStoryProperties), [duration])
    const pages = [1, 2]

    return (
        <>
            <nav className={classes.stepper} style={stepperStyle}>
                {pages.map((page, index) => {
                    const classNames = {
                        [classes.stepperItem]: true,
                        [classes.stepperItemActive]: activePage === index,
                        [classes.stepperItemActivePaused]: activePage === index && !playing,
                        [classes.stepperItemDone]: activePage > index
                    }
                    return <a onClick={() => setPage(index)} key={page} className={asClassName(classNames)}></a>
                })}
            </nav>
            <section className={classes.page}>
                <h1>Page {activePage + 1}</h1>
                <button onClick={() => togglePlaying()}>PAUSE</button>
            </section>
        </>
    )
}

export function MonBixiDialog() {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<StatsDetail>();

    const duration = 5_000
    const { setPlaying, ...storiesProps } = useStoriesTimer({ duration, pageCount: 2 })

    useRideStoreTx(async (db) => {
        setLoading(true)
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)

        setLoading(false)
        setPlaying(true)
        setStats((stats) => ({ ...stats, ...freshStats.stats }))
    })

    useOpenMonBixi(() => {
        dialogRef.current?.showModal()
    });

    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            <Stories {...storiesProps} duration={duration} />
        </dialog>
    );
}
