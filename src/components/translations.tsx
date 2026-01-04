type Formatted = (args: any[]) => string
type Formatter = (...arg: number[]) => Formatted

const isNumber = (a: any): a is number => Number.isFinite(a)

function _(strings: TemplateStringsArray, ...indices: (number | Formatted)[]) {
    return (args: any[]) => strings.reduce((acc, s, i) => {
        if (isNumber(indices[i]))
            return `${acc}${s}${args[indices[i]] ?? ""}`
        if (indices[i] instanceof Function)
            return `${acc}${s}${indices[i](args)}`
        return `${acc}${s}`
    }, "").trim()
}

const timeFormatter = (_: { minutes: string, hours: string }): Formatter => (...arg: number[]) => (args: any[]) => {
    const number = args[arg[0]]
    if (!isNumber(number)) return ""
    if (number > 3600) {
        const x = Math.round(number / 3600)
        return `${x} ${_.hours}`
    } else {
        const x = Math.round(number / 60)
        return `${x} ${_.minutes}`
    }
}

const distance: Formatter = (...arg: number[]) => (args: any[]) => {
    const number = args[arg[0]]
    if (!isNumber(number)) return ""
    if (number > 1000) {
        const x = Math.round(number / 1000)
        return `${x} km`
    } else {
        const x = Math.round(number)
        return `${x} m`
    }
}

const temps = timeFormatter({ minutes: "minutes", hours: "heures" })
const frTexts = {
    analyzingRides: "Analyse de vos déplacements...",
    myYearWithBixi: "Mon année avec Bixi",
    myYearWithBixiLong: _`Mon année\n${0}\navec Bixi`,
    weSpentHoursTogether: _`Cette année, on a passé ${temps(0)} ensemble.\nPas mal, non ?`,
    tripAverage: _`Durée moyenne d'un trajet : ${temps(0)}`,
    youRode: "Cette année, tu as roulé un total de ...",
    averageDist: _`Distance moyenne d'un trajet : ${distance(0)}`,
    yourHome: "Ton quartier, c'est",
    mostUsedStation: _`Station la plus utilisée : ${0}`,
    tripsFromTo: _`Nombre de trajets depuis/vers ${0} : ${1}`,
    winter: `C'est l'hiver ?`,
    notEvenCold: `Même pas froid !`,
    winterTrips: _`Tu as effectué ${0} trajets à Bixi en hiver.`,
    download: "Télécharger les stories",
    share: "Partage le bilan de ton année avec Bixi !",
    estimate: "Estimation à partir du départ/arrivée et de la durée"
}

const time = timeFormatter({ minutes: "minutes", hours: "hours" })
const enTexts: typeof frTexts = {
    analyzingRides: "Analyzing your rides...",
    myYearWithBixi: "This year with Bixi",
    myYearWithBixiLong: _`My journey\nwith Bixi in\n${0}`,
    weSpentHoursTogether: _`We spent ${time(0)} or so together this year.\nNot bad, uh?`,
    tripAverage: _`Average ride duration: ${time(0)}`,
    youRode: "This year, you rode a total of...",
    averageDist: _`Average trip distance: ${distance(0)}`,
    yourHome: "A place you call home:",
    mostUsedStation: _`Most used station: ${0}`,
    tripsFromTo: _`Trips from/to ${0}: ${1}`,
    winter: `Winter, uh?`,
    notEvenCold: `Ain't even that cold!`,
    winterTrips: _`You used Bixi ${0} times during winter.`,
    download: "Download the stories",
    share: "Share your Bixi stories of the year!",
    estimate: "Estimate based on start/end points and duration"
}

type Keys = keyof typeof frTexts

export const translate = (lang: "fr" | "en") => (key: Keys, ...args: any[]) => {
    const val = lang === "fr" ? frTexts[key] : enTexts[key]
    return args.length > 0 && val instanceof Function ? val(args) : val.toString()
}