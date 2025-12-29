import { DependencyList, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { MonBixiDialog } from "./mon-bixi-dialog";
import browser from "webextension-polyfill";

const OPEN_MON_BIXI_EVENT = "openmonbixi"

function querySelector(selector: string): Promise<Element> {
    return new Promise((resolve) => {
        const observer = new MutationObserver(mut => {
            const el = document.querySelector(selector);
            if (!el) return
            observer.disconnect();
            resolve(el);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

export function useOpenMonBixi(handler: () => void, deps: DependencyList = []) {
    return useEffect(() => {
        document.addEventListener(OPEN_MON_BIXI_EVENT, handler)
        return () => document.removeEventListener(OPEN_MON_BIXI_EVENT, handler)
    }, deps)
}

function ensureReactDialogInjected(): HTMLElement {
    const contentId = "mon-bixi";
    let content: HTMLElement | null = document.getElementById(contentId)
    if (content != null) return content

    content = document.createElement("div")
    content.id = contentId
    content.attachShadow({ mode: "open" })
    document.body.appendChild(content)

    ReactDOM.createRoot(content.shadowRoot!).render(
        <>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=pause,play_arrow" />
            <link rel="stylesheet" type="text/css" href={browser.runtime.getURL("mon-bixi.css")} />
            <MonBixiDialog />
        </>
    );
    return content
}

async function ensureTabInjected() {
    ensureMobileTabInjected()
    ensureDesktopTabInjected()
}

function setupNav(nav: Element, tabId: string) {
    if (document.getElementById(tabId)) return

    const allLinks = nav?.querySelectorAll("a[href]")
    const anyNonSelectedLink = Array.from(allLinks?.values() ?? [])
        .find((link: Element) => link.tagName.toLowerCase() === "a" &&
            !window.location.toString().replace(/#$/, "").endsWith(link.getAttributeNode("href")?.value ?? ""))

    if (nav == undefined || anyNonSelectedLink == undefined) {
        return
    }

    const newTab = anyNonSelectedLink.cloneNode(true)
    if (newTab == undefined || !(newTab instanceof Element)) return
    newTab.setAttribute("href", "#")
    newTab.id = tabId
    const text = newTab.querySelector("[data-testid=core-ui-text]")
    if (text) text.textContent = "Mon année avec Bixi"

    ensureReactDialogInjected()

    const openMonBixi = new CustomEvent(OPEN_MON_BIXI_EVENT);
    newTab.addEventListener("click", () => document.dispatchEvent(openMonBixi))

    nav.appendChild(newTab)
}

async function ensureMobileTabInjected() {
    const tabId = "mon-bixi-tab-mobile";
    const nav = await querySelector("[data-testid=mobile] nav *:has(> a[href])")
    setupNav(nav, tabId)
}

async function ensureDesktopTabInjected() {
    const tabId = "mon-bixi-tab";
    const nav = await querySelector("[data-testid=DATA_TESTID_CONTEXTUAL_NAV]")
    setupNav(nav, tabId)
}

function onNextJsUpdate(cb: () => void) {
    const observer = new MutationObserver(mut => cb());
    observer.observe(document.getElementById("__next")!, { childList: true, subtree: true });
}

if (window.location.toString().startsWith("https://secure.bixi.com/")) {
    onNextJsUpdate(ensureTabInjected)
    ensureTabInjected()
}
