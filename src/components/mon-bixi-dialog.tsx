import { createContext, MouseEvent, useContext, useEffect, useRef, useState } from "react";
import { useIndexDb } from "../data/indexdb";
import { useOpenMonBixi } from "../extension";
import classes from "../extension.module.css";
import { getLastStats, getUpdatedStats, StatsDetail } from "../data/compute-stats";
import { StoriesSlideshow, useStories, useStoriesSlideshow } from "./stories";
import { Stage } from "react-konva";
import { pageCount, StoryContent } from "./story-content";
import { translate } from "./translations";

function Loading({ loadingProgress }: { loadingProgress: number }) {
    const _ = useLocale()
    return loadingProgress < 100 && (
        <div className={classes.loading}>
            <div className={classes.loadingProgress} style={{ "--loadingValue": loadingProgress } as any} />
            <p>{_("analyzingRides")}</p>
        </div>
    )
}

type Download = { filename: string, url: string, id: number }

function DownloadButton({ downloadList, showOnPage }: { showOnPage: number, downloadList: Download[] }) {
    const _ = useLocale()
    const { activePage } = useStories()

    const [index, setIndex] = useState(-1)
    const a = useRef<HTMLAnchorElement>(null)

    // hacky trick to download multiple files: clicking an anchor <a> with href+download attributes triggers a download
    // we recursively update these attributes and trigger another (synthetic) click to download all our files with a single (real) click 
    const onClick = (e: MouseEvent) => {
        if (index === -1) e.preventDefault()
        if (index < downloadList.length - 1) {
            setIndex(index + 1)
            setTimeout(() => a.current?.click(), 1000)
        } else {
            setIndex(-1)
        }
    }

    return activePage === showOnPage && <a ref={a}
        className={classes.bigButton}
        onClick={(e) => onClick(e)}
        href={downloadList[index]?.url}
        download={downloadList[index]?.filename}>{_("download")}</a>
}

const Locale = createContext("fr")
export function useLocale() {
    const lang = useContext(Locale)
    return translate(lang === "fr" ? "fr" : "en")
}

export function MonBixiDialog({ year, lang }: { year: number, lang: string }) {
    const [{ clientWidth, clientHeight }, setClientSize] = useState({ clientWidth: 0, clientHeight: 0 })
    const dialogRef = useRef<HTMLDialogElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const observer = useRef(new ResizeObserver(() => {
        if (!dialogRef.current) return
        const { clientWidth, clientHeight } = dialogRef.current
        setClientSize({ clientWidth, clientHeight })
    }))

    useEffect(() => {
        if (!dialogRef.current) return
        dialogRef.current.addEventListener("close", () => setOpen(false))
        observer.current.observe(dialogRef.current)
    }, [])

    const [open, setOpen] = useState(false)
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [stats, setStats] = useState<StatsDetail>();
    const [downloadsList, setDownloads] = useState<Download[]>([])

    const { setPlaying, ...storiesProps } = useStoriesSlideshow({
        duration: 4_000,
        pageCount: pageCount(stats),
        // save the rendered canvas before changing pages
        onBeforeNextPage: (page: number, total: number) => {
            if (!canvasRef.current || page === total - 1 || downloadsList.find(({ id }) => id === page) !== undefined) return
            downloadsList.splice(page, 0, {
                url: canvasRef.current.toDataURL("image/png"),
                filename: `story_${page}.png`,
                id: page
            })
            setDownloads(downloadsList)
        }
    })

    useIndexDb(async (db) => {
        // optimistic: use existing stats
        const oldStats = await getLastStats(db, year)
        if (oldStats) setStats(oldStats.stats)

        // get fresh data afterward
        const latestStatsGenerator = getUpdatedStats(db, year)
        let done = false
        while (!done) {
            const next = await latestStatsGenerator.next();
            done = next.done ?? true
            if (next.done) {
                setStats(next.value.stats)
            } else {
                setLoadingProgress(next.value)
            }
        }
    })

    // event from the extension main script
    useOpenMonBixi(() => { setOpen(true) });

    useEffect(() => {
        if (stats) setPlaying(open)
    }, [open, stats])

    useEffect(() => {
        if (open) dialogRef.current?.showModal()
        else dialogRef.current?.close()
    }, [open])


    return (
        <Locale.Provider value={lang}>
            <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
                {stats && clientWidth !== 0 && <StoriesSlideshow {...storiesProps} close={() => setOpen(false)}>
                    <Stage width={clientWidth} height={clientHeight} scale={{ x: clientWidth / 100, y: clientWidth / 100 }}>
                        <StoryContent ref={canvasRef} width={100} height={clientHeight * 100 / clientWidth} stats={stats} />
                    </Stage>
                    <DownloadButton showOnPage={pageCount(stats) - 1} downloadList={downloadsList} />
                </StoriesSlideshow>}
                {!stats && <Loading loadingProgress={loadingProgress} />}
            </dialog>
        </Locale.Provider>
    );
}
