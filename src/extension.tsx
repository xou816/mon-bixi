import { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { MonBixiDialog } from "./components/mon-bixi-dialog";
import browser from "webextension-polyfill";
import { translate } from "./components/translations";

const OPEN_MON_BIXI_EVENT = "openmonbixi"

// used to wait for an element to be in the DOM
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

export function useOpenMonBixi(handler: () => void) {
    return useEffect(() => {
        document.addEventListener(OPEN_MON_BIXI_EVENT, handler)
        return () => document.removeEventListener(OPEN_MON_BIXI_EVENT, handler)
    }, [])
}

function ensureReactDialogInjected(lang: "fr" | "en") {
    const contentId = "mon-bixi";
    if (document.getElementById(contentId)) return

    const content = document.createElement("div")
    content.id = contentId
    content.attachShadow({ mode: "open" })
    document.body.appendChild(content)

    ReactDOM.createRoot(content.shadowRoot!).render(
        <>
            <link rel="stylesheet" type="text/css" href={browser.runtime.getURL("mon-bixi.css")} />
            <MonBixiDialog year={2025} lang={lang} />
        </>
    );
}

async function ensureTabInjected() {
    // couldn't find a more reliable way to detect the language, will do for now!
    const lang = document.querySelector(`a[href^="https://bixi.com/en/"]`) !== null ? "en" : "fr"
    ensureMobileTabInjected(lang)
    ensureDesktopTabInjected(lang)
    ensureReactDialogInjected(lang)
}

function setupNav(nav: Element, tabId: string, lang: "fr" | "en") {
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
    if (text) text.textContent = translate(lang)("myYearWithBixi")


    const openMonBixi = new CustomEvent(OPEN_MON_BIXI_EVENT);
    newTab.addEventListener("click", () => document.dispatchEvent(openMonBixi))

    nav.appendChild(newTab)
}

async function ensureMobileTabInjected(lang: "fr" | "en") {
    const tabId = "mon-bixi-tab-mobile";
    const nav = await querySelector("[data-testid=mobile] nav *:has(> a[href])")
    setupNav(nav, tabId, lang)
}

async function ensureDesktopTabInjected(lang: "fr" | "en") {
    const tabId = "mon-bixi-tab";
    const nav = await querySelector("[data-testid=DATA_TESTID_CONTEXTUAL_NAV]")
    setupNav(nav, tabId, lang)
}

function onNextJsUpdate(cb: () => void) {
    // bixi's UI uses NextJS, we must re inject our link if Next/React changes the DOM
    const observer = new MutationObserver(() => cb());
    observer.observe(document.getElementById("__next")!, { childList: true, subtree: true });
}

if (window.location.toString().startsWith("https://secure.bixi.com/")) {
    onNextJsUpdate(ensureTabInjected)
    ensureTabInjected()
}
