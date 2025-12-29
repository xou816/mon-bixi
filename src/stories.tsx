import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import classes from "./extension.module.css";

type TimeoutData = {
    timeout: ReturnType<typeof setTimeout> | undefined,
    latest: number | undefined, // latest date recorded when entering playing state
    elapsed: number // elapsed time, computed when pausing
}

export type Story = {
    id: string,
    render: () => JSX.Element,
}

export function useStoriesSlideshow({ pages, duration }: { pages: Story[], duration: number }) {
    const pageCount = pages.length
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

        if (playing && activePage <= pageCount - 1 && activePage > -1) {
            if (!timeout) {
                console.log(`Running for ${duration - elapsed}ms`)
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

    return { playing, activePage, setPlaying, setPage, togglePlaying, pages }
}

const asClassName = (classTab: { [k: string]: boolean }) => Object.entries(classTab).reduce((str, [klass, active]) => `${str} ${active ? klass : ""}`.trimEnd(), "")

type StoriesProps = {
    playing: boolean,
    activePage: number,
    duration: number,
    setPage: (p: number) => void,
    togglePlaying: () => void,
    pages: Story[]
}

export function Stories({ playing, activePage, duration, setPage, togglePlaying, pages }: StoriesProps) {
    type CSSStoryProperties = { "--stepperTiming": string } & CSSProperties
    const stepperStyle = useMemo(() => ({ "--stepperTiming": `${duration}ms` } as CSSStoryProperties), [duration])

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
                    return <a onClick={() => setPage(index)} key={page.id} className={asClassName(classNames)}></a>
                })}
            </nav>
            <button className={classes.pauseButton} onClick={() => togglePlaying()}>{playing ? <>&#10073;&#10073;</> : <>&#9658;</>}</button>
            <section className={classes.storyPage} key={activePage}>
                {pages[activePage]?.render()}
            </section>
        </>
    )
}