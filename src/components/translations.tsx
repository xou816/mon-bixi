function _(strings: TemplateStringsArray, ...indices: number[]) {
    return (args: any[]) => strings.reduce((acc, s, i) => `${acc}${s}${args[indices[i]] ?? ""}`, "").trim()
}

const frTexts = {
    analyzingRides: "Analyse de vos déplacements...",
    myYearWithBixi: "Mon année avec Bixi",
    myYearWithBixiLong: _`Mon année\n${0}\navec Bixi`,
    weSpentHoursTogether: _`Cette année, on a passé ${0} heures ensemble.\nPas mal, non ?`,
    tripAverage: _`Durée moyenne d'un trajet : ${0} minutes`,
    youRode: "Cette année, tu as roulé un total de ...",
    averageDist: _`Distance moyenne d'un trajet : ${0} km`,
    yourHome: "Ton quartier, c'est",
    mostUsedStation: _`Station la plus utilisée : ${0}`,
    tripsFromTo: _`Nombre de trajets depuis/vers ${0} : ${1}`,
    winter: `C'est l'hiver ?`,
    notEvenCold: `Même pas froid !`,
    winterTrips: _`Tu as effectué ${0} trajets à Bixi en hiver.`,
    download: "Télécharger les stories",
    share: "Partage le bilan de ton année avec Bixi !"
}

const enTexts: typeof frTexts = {
    analyzingRides: "Analyzing your rides...",
    myYearWithBixi: "This year with Bixi",
    myYearWithBixiLong: _`My journey\nwith Bixi in\n${0}`,
    weSpentHoursTogether: _`We spent ${0} hours or so together this year.\nNot bad, uh?`,
    tripAverage: _`Average ride duration: ${0} minutes`,
    youRode: "This year, you rode a total of...",
    averageDist: _`Average trip distance: ${0} km`,
    yourHome: "A place you call home:",
    mostUsedStation: _`Most used station: ${0}`,
    tripsFromTo: _`Trips from/to ${0}: ${1}`,
    winter: `Winter, uh?`,
    notEvenCold: `Ain't even that cold!`,
    winterTrips: _`You used Bixi ${0} times during winter.`,
    download: "Download the stories",
    share: "Share your Bixi stories of the year!"
}

type Keys = keyof typeof frTexts

export const translate = (lang: "fr" | "en") => (key: Keys, ...args: any[]) => {
    const val = lang === "fr" ? frTexts[key] : enTexts[key]
    return args.length > 0 && val instanceof Function ? val(args) : val.toString()
}