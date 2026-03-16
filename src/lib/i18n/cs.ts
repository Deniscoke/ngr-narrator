// ============================================================
// Čeština — centralizovaný zdroj UI řetězců pro Dračí Hlídku
// Jediný jazyk aplikace; tento soubor zabraňuje budoucí
// nekonzistenci (slovenské/smíšené texty).
// ============================================================

export const CS = {
  dice: {
    character: "Postava:",
    lastRoll: "Poslední hod:",
    bonusRoll: "Bonusový hod",
    criticalLabel: "KRITICKÝ!",
    rollK6: "k6",
    rollK20: "k20",
    reset: "Nový hod",
    criticalHint: "🎲 Kritický hod — máš nárok na bonusový hod!",
    bonusUsed: "Bonusový hod byl použit.",
  },
  errors: {
    notLoggedIn: "Nejsi přihlášen nebo platnost session vypršela. Přihlas se znovu.",
    noAccess: "Nemáš přístup k této kampani.",
    loadFailed: "Chyba při načítání dat.",
    loadFailedDetail: (msg: string) => `Chyba při načítání dat: ${msg}`,
    saveFailed: "Nepodařilo se uložit změny postavy. Zkus znovu nebo obnov stránku.",
    serverUnreachable: "Nepodařilo se spojit se serverem.",
    invalidDiceSequence: "Neplatná sekvence hodů kostkou.",
  },
  narrate: {
    combatRules: "Bojová pravidla (DH-LITE)",
    campaignMemory: "Paměť kampaně (shrnutí)",
    noMemory: "Zatím žádné shrnutí — vygeneruj první vyprávění.",
    generating: "Generuji…",
    generate: "Generovat vyprávění",
    listening: "Poslouchám…",
    mic: "Mikrofon",
    sttUnsupported: "Hlasový vstup není podporován v tomto prohlížeči.",
    narratorOutput: (mode: string) => `Výstup vypravěče (${mode})`,
  },
  map: {
    currentLocation: "Aktuální poloha",
    markers: "Body na mapě",
    noData: "Mapa se naplní po prvním vyprávění.",
    worldOthion: "Svět Othion",
    tabWorld: "Mapa světa",
    tabLocation: "Místo",
    tabCombat: "Boj",
  },
} as const;
