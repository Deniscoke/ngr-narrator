"use client";

export default function RulesPage() {
  const sections = [
    {
      title: "Tvorba postavy",
      description: "Rasy, povolania, schopnosti, výber výbavy",
      status: "planned",
    },
    {
      title: "Boj a súboj",
      description: "Iniciatíva, útoky, obrana, zranenia",
      status: "planned",
    },
    {
      title: "Mágia",
      description: "Kúzla, magenergia, rituály",
      status: "planned",
    },
    {
      title: "Vybavenie",
      description: "Zbrane, brnenia, predmety, obchod",
      status: "planned",
    },
    {
      title: "Bestiár",
      description: "Príšery, zvieratá, démoni",
      status: "planned",
    },
    {
      title: "Pravidlá pre PJ",
      description: "Vedenie hry, tvorba príbehu, odmeny",
      status: "planned",
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-zinc-100 mb-2">
        Knižnica pravidiel
      </h1>
      <p className="text-zinc-400 text-sm mb-6">
        Štruktúra pre budúcu integráciu pravidiel. Obsah bude parafrazovaný z
        licencovaných zdrojov.
      </p>

      <div className="space-y-2">
        {sections.map((s) => (
          <div
            key={s.title}
            className="border border-zinc-800 rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-zinc-200 font-medium text-sm">{s.title}</p>
              <p className="text-xs text-zinc-500">{s.description}</p>
            </div>
            <span className="text-xs text-zinc-600 border border-zinc-800 rounded px-2 py-1">
              Plánované
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <p className="text-xs text-zinc-500">
          <strong className="text-zinc-400">Právna poznámka:</strong> Pravidlá
          sú spracované ako parafrázované zhrnutia. Žiadny pôvodný text nie je
          reprodukovaný. Systém je navrhnutý ako generický RPG engine s
          výmennými modulmi pravidiel.
        </p>
      </div>
    </div>
  );
}
