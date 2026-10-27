// de 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** Deutsch; fehlende Schlüssel fallen auf Englisch zurück. */
const de: Partial<Messages> = {
	tabGeneral: "Allgemein",
	tabTemplates: "Pfade & Vorlagen",
	tabMaintenance: "Wartung",
	tabAbout: "Über",

	languageName: "Sprache",
	languageDesc: "Anzeigesprache für Einstellungen und Befehle.",
	langAuto: "Automatisch (Obsidian folgen)",
	languageChangeHint: "Befehlsnamen werden nach dem Neuladen des Plugins aktualisiert.",

	autoNumberName: "Globale automatische Nummerierung",
	autoNumberDesc:
		"Nummeriert Überschriften beim Bearbeiten; sonst „Jetzt neu nummerieren“ nutzen.",

	debounceName: "Verzögerung",
	debounceDesc: (min, max, def) =>
		`Wartezeit nach dem letzten Tastendruck bis zur Nummerierung (${min}–${max} ms, Standard ${def}).`,
	resetTooltip: (def) => `Auf Standard zurücksetzen (${def} ms)`,

	updateBacklinksName: "Interne Links synchronisieren (Backlinks)",
	updateBacklinksDesc:
		"Ändert sich eine Überschrift, werden Links darauf in anderen Notizen angepasst.",

	headingLinkSuggestName: "Überschrift-Links beim Tippen vorschlagen",
	headingLinkSuggestDesc:
		"Schlägt passende Überschriften aus dem Vault beim Tippen vor; Tab fügt einen Link ein.",
	headingSuggestThisFile: "(diese Datei)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Tresor zu groß: Überschriftenindex nur teilweise erstellt (${indexed} indiziert); Vorschläge gelten im indizierten Bereich.`,
	vcTargetName: "Vorschläge anzeigen in",
	vcTargetDesc:
		"Das Popup dieses Plugins überdeckt das von VC; mit VC erscheinen Überschriften in dessen Popup.",
	vcTargetPlugin: "Popup dieses Plugins",
	vcTargetVc: "Popup von Various Complements",

	sectionInterface: "Oberfläche",
	sectionNumbering: "Automatische Nummerierung",
	sectionLinking: "Link-Pflege",
	sectionSuggest: "Vorschläge für Überschrift-Links",
	sectionNoteEntry: "Menüs",
	headingMenuName: "Überschriften-Menü",
	headingMenuDesc:
		"Rechtsklick auf den Pfeil links der Überschrift: Ebene ändern, Nummerierung überspringen, Link kopieren.",
	statusBarMenuName: "Statusleisten-Menü",
	statusBarMenuDesc:
		"Die Statusleiste zeigt den Nummerierungsstatus; per Klick Auto-Nummerierung oder Vorlage wechseln.",

	vcNotInstalledNotice:
		"Various Complements nicht gefunden (nicht installiert oder deaktiviert); automatische Konfiguration abgebrochen. Installieren und aktivieren Sie es oder nutzen Sie die manuelle Einrichtung.",
	vcDictionaryPathLabel: "Pfad der Wörterbuchdatei",
	vcCopyPathButton: "Pfad kopieren",
	noticeVcPathCopied: "Pfad der Wörterbuchdatei kopiert.",
	vcManualConfirmTitle: "Manuelle Integration aktivieren",
	vcManualConfirmBody:
		"Im Plugin-Ordner wird eine Überschriften-Wörterbuchdatei erzeugt und gepflegt (an VC wird nichts geändert). Kopieren Sie den Pfad in „Custom dictionary paths“ von VC und aktivieren Sie „Custom dictionary complement“; „Displayed text suffix“ sollte geleert werden, sonst erscheinen Kandidaten als „Überschrift => ...“.",
	vcManualConfirmButton: "Wörterbuch erzeugen",
	vcAutoConfirmTitle: "Automatische Integration aktivieren",
	vcAutoConfirmBody:
		"Ein Überschriften-Wörterbuch wird erzeugt und VC automatisch konfiguriert (mit Sicherheitsprüfungen; lässt sich nicht sicher schreiben, wird abgebrochen, ohne Ihre VC-Einstellungen anzutasten). Fortfahren?",
	vcAutoConfirmPoints: [
		"Überschriften-Wörterbuch erzeugen und pflegen (höchstens 20.000 Einträge)",
		"VC-Einstellungen schreiben: Wörterbuchpfad, „Custom dictionary complement“ und Auslöseschwelle von mindestens 2 Zeichen",
		"„Displayed text suffix“ von VC leeren (global: betrifft auch Ihre anderen Wörterbücher)",
		"„Max number of suggestions“ von VC auf mindestens 10 erhöhen (global; nur erhöht, nie gesenkt)",
		"VC-Wörterbücher nach dem Schreiben neu laden (ein Fehler wird gesondert gemeldet)",
	],
	vcDescriptionOffHint:
		"VC blendet die Quellzeile der Kandidaten aus (Description on suggestion: None).",
	vcOffConfirmTitle: "Wörterbuch-Integration beenden",
	vcOffConfirmBody:
		"Das Überschriften-Wörterbuch wird nicht mehr aktualisiert. Various Complements lädt es noch – auch aus VC entfernen? Andernfalls nutzt VC weiter dieses veraltete Wörterbuch (umbenannte Überschriften können defekte Links einfügen).",
	vcOffKeepButton: "Behalten",
	vcOffRemoveButton: "Aus VC entfernen",
	vcStaleDictName: "VC lädt noch das alte Überschriften-Wörterbuch",
	vcStaleDictDesc:
		"Es wird nicht mehr aktualisiert; umbenannte Überschriften können defekte Links einfügen.",
	vcStaleDictRemoveButton: "Entfernen",
	noticeVcDictRemoved:
		"Das Überschriften-Wörterbuch dieses Plugins wurde aus Various Complements entfernt.",
	noticeVcDictRemoveFailed:
		"Die Einstellungen von Various Complements konnten nicht gelesen werden. Entfernen Sie diesen Wörterbuchpfad bitte manuell in den VC-Einstellungen.",
	vcAutoConfirmButton: "Bestätigen und konfigurieren",
	vcAutoManualButton: "Manuelle Einrichtung",
	noticeVcAutoWriteSuccess: "Integration mit Various Complements automatisch konfiguriert.",
	noticeVcAutoWriteInvalidShape:
		"Das Format der VC-Konfiguration entspricht nicht den Erwartungen; automatisches Schreiben abgebrochen (Einstellungen unverändert). Nutzen Sie die manuelle Einrichtung oder prüfen Sie die VC-Konfiguration.",
	noticeVcAutoWriteNotInstalled:
		"VC konnte nicht automatisch konfiguriert werden (nicht installiert, deaktiviert oder Datendatei fehlt); installieren und aktivieren Sie es oder nutzen Sie die manuelle Einrichtung.",
	noticeVcReloadFailed:
		"Wörterbuch und VC-Einstellungen wurden geschrieben, aber das Neuladen schlug fehl; führen Sie den VC-Befehl „Reload custom dictionaries“ aus (oder starten Sie Obsidian neu).",
	noticeVcDictionaryTruncated: (total) =>
		`Die Gesamtzahl der Überschriften (${total}) überschreitet das Wörterbuchlimit; es wurde gekürzt und gilt im enthaltenen Bereich.`,

	pathRulesHeading: "Pfadregeln",
	pathRulesDesc:
		"Ordnet Pfaden Vorlagen zu: Ordnerregeln enden auf „/“, die Wurzelregel „/“ ist der globale Standard, die spezifischste Regel gewinnt.",
	pathNoRootWarn:
		"⚠ Keine Wurzel-Pfadregel (/). Bei aktiver globaler automatischer Nummerierung werden Dateien ohne passende Regel nicht nummeriert.",
	addRootRule: "+ Wurzelregel / hinzufügen",
	addRule: "Regel hinzufügen",
	pathColPattern: "Pfad",
	pathColTemplate: "Vorlage",
	pathEmpty:
		"(Noch keine Regeln; mit einer Wurzelregel „/“ gilt die Nummerierung für den ganzen Tresor.)",
	pathInputPlaceholder: "z. B. Projekte/ oder Notizen/Konzentriertes Arbeiten.md oder /",
	templateMissingSuffix: (name) => `${name} (fehlt)`,
	clearInputTooltip: "Diesen Pfad leeren",
	deleteRuleTooltip: "Diese Regel löschen",
	dragHandleTooltip: "Zum Umsortieren ziehen",
	pathDuplicateWarn: (otherRow) =>
		`Dieser Pfad wird schon von Regel Nr. ${otherRow} verwendet; ein Pfad kann nur einer Vorlage zugeordnet sein. Ändern oder löschen Sie eine der beiden.`,
	pathSuggestEmptyFolder: "(Dieser Ordner ist leer)",
	pathSuggestBackTooltip: "Eine Ebene nach oben",
	pathSuggestDescendTooltip: "Inhalt anzeigen",
	pathSuggestSelectHereTooltip: "Diese Ebene auswählen",
	pathTemplateNone: "Keine Nummerierung",
	batchRenumberTooltip: "Stapel-Neunummerierung: alle Dateien dieser Regel neu nummerieren",
	batchRenumberNoneTooltip:
		"Diese Regel steht auf „Keine Nummerierung“ – nichts neu zu nummerieren",
	batchModalTitle: "Stapel-Neunummerierung",
	batchModalBody: (pattern, count) =>
		`Nummeriert ${count} Markdown-Datei(en), die „${pattern}“ entsprechen, jeweils mit ihrer wirksamen Vorlage neu. ` +
		"Dateien mit „Keine Nummerierung“, per Frontmatter deaktivierte oder mit nicht übernommener Fremdnummerierung werden übersprungen; " +
		"geöffnete Dateien lassen sich rückgängig machen, geschlossene werden direkt überschrieben.",
	batchModalConfirm: "Neu nummerieren",
	batchModalCancel: "Abbrechen",
	pathColMode: "Nummerierung",
	pathModeWrite: "In Datei schreiben",
	pathModeVirtual: "Nur anzeigen",
	pathModeTooltip:
		"In Datei schreiben: Nummern werden in die Notiz geschrieben und sind in externen Editoren, GitHub und Publish sichtbar. Nur anzeigen: Nummern erscheinen nur in Obsidian, die Notiz bleibt unverändert.",
	batchRenumberVirtualTooltip:
		"Diese Regel ist „Nur anzeigen“ – Nummern werden nicht geschrieben, nichts neu zu nummerieren",
	modeModalTitle: "Nummerierungsmodus ändern",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} Datei(en) enthalten von diesem Plugin geschriebene Nummern; das Plugin schreibt nicht mehr hinein ` +
		`(${toVirtual} wechseln zu „Nur anzeigen“, ${toNone} zu „Keine Nummerierung“).`,
	modeModalClearLabel:
		"Die vom Plugin in diese Dateien geschriebenen Nummern entfernen (handgeschriebene bleiben unberührt). Ohne Haken bleiben die Nummern; Dateien im Modus „Nur anzeigen“ weisen sie als Reste aus.",
	modeModalEntering: (count) =>
		`${count} Datei(en) wechseln von „Nur anzeigen“ zu „In Datei schreiben“.`,
	modeModalWriteLabel:
		"Nummern jetzt in diese Dateien schreiben (sonst bei der nächsten Bearbeitung; geöffnete Dateien werden sofort aktualisiert)",
	modeModalConfirm: "Bestätigen",
	noticeModeCleared: (count) => `Vom Plugin geschriebene Nummern in ${count} Datei(en) entfernt`,

	templatesHeading: "Vorlagen",
	templatesDesc:
		"Legt Nummernformat und Ausnahmeliste je Überschriftsebene fest; welche Datei welche Vorlage nutzt, bestimmen die Pfadregeln oben.",
	addTemplate: "Neue Vorlage",
	deleteBtn: "Löschen",

	topLevelName: "Startebene",
	bottomLevelName: "Endebene",
	ancestorSelf: "Eigener Stil (1.a.①)",
	ancestorArabic: "Alles arabisch (一 / 1.1)",

	colLevel: "Ebene",
	colPrefix: "Präfix",
	colNumeral: "Zahlenart",
	colNumberSep: "Zahlentrenner",
	colSuffix: "Suffix",
	colTitleSep: "Titeltrenner",
	colPreview: "Vorschau",
	inheritDepthAll: "Alle",
	previewHeadingWord: "Überschrift",

	skipFillFill: "Auffüllen",
	skipFillDrop: "Weglassen (Segment auslassen)",
	skipFillNone: "Nicht nummerieren (unverändert lassen)",

	matchExact: "Exakt",
	matchPartial: "Teilweise",
	matchSubtree: "Teilbaum",

	wlInputPlaceholder: "Wort eingeben und Enter drücken…",
	wlFilterPlaceholder: "Einträge filtern…",
	wlSortAdded: "Nach Hinzufügen",
	wlSortAz: "A–Z",
	wlSortMatch: "Nach Treffertyp",
	wlFilterNoMatch: "(Kein Eintrag passt zum Filter)",
	wlEmpty:
		"Noch keine Einträge – oben ein Wort eingeben und Enter drücken; passende Überschriften bleiben unnummeriert.",
	wlEditTitle: "Zum Bearbeiten klicken",
	wlChipWarnTitle:
		"Die passende Überschrift hat Unterüberschriften; diese bleiben nummeriert und würden am vorherigen nummerierten Vorfahren hängen. Mit „Teilbaum“ wird der ganze Block ausgenommen.",
	wlPreviewNoFile:
		"(Öffnen Sie eine Markdown-Datei mit Überschriften, um die Treffer dieser Liste anzuzeigen.)",
	wlPreviewNone: "Keine Überschrift der aktuellen Datei wird von dieser Liste ausgenommen.",
	wlPreviewSome: (count, titles) =>
		`Diese Liste nimmt ${count} Überschrift(en) der aktuellen Datei aus: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ Nach den Pfadregeln nutzt diese Datei tatsächlich die Vorlage „${appliedName}“, nicht die bearbeitete; die Vorschau unten ist hypothetisch.`,
	wlPreviewNoTemplate:
		"⚠ Die aktuelle Datei passt auf keine Pfadregel und wird nicht automatisch nummeriert; die Vorschau unten ist hypothetisch.",

	clearVaultName: "Nummerierung im ganzen Tresor löschen",
	clearVaultDesc:
		"Entfernt die Nummern dieses Plugins aus allen Notizen und schaltet die Automatik aus.",
	clearVaultBtn: "Tresor-Nummerierung löschen…",
	freezeVaultName: "Nummerierung festschreiben und Besitz abgeben",
	freezeVaultDesc: "Behält die Nummern, entfernt unsichtbare Marker, beendet die Nummerierung.",
	freezeVaultBtn: "Nummerierung festschreiben…",
	retiredBannerTitle: "Das Plugin hat den Besitz Ihrer Nummerierung abgegeben",
	retiredBannerBody:
		"Ihre Nummern bleiben als normaler Text erhalten, das Plugin nummeriert derzeit nicht automatisch. Um die Kontrolle zurückzugeben: Schaltfläche unten klicken und dann „Fremde Nummerierung bereinigen“ für die betroffenen Dateien ausführen, sonst werden vorhandene Nummern mit einem neuen Präfix doppelt.",
	resumeBtn: "Nummerierung wieder verwalten",

	aboutLinkRepo: "GitHub-Repository",
	aboutLinkIssues: "Problem melden",

	aboutCreditsHeading: "Danksagung",
	aboutCreditsIntro: "Die Entwicklung hat Ideen dieser Open-Source-Plugins aufgegriffen.",
	aboutCreditPathSuggest: "Ordner-/Dateivorschläge und Abgleich bei der Pfadeingabe",
	aboutCreditBacklinks: "Ursprüngliche Referenz für die Backlink-Synchronisierung",
	aboutCreditWordJoiner:
		"Ursprüngliche Referenz für das Markieren von Nummern mit unsichtbaren Zeichen",

	defaultTemplateDisplay: "Standard",

	delModalTitle: (name) => `Vorlage „${name}“ löschen`,
	delModalBody: (count) => `Diese ${count} Pfadregel(n) verwenden die Vorlage:`,
	delModalEmptyPath: "(leerer Pfad)",
	delModalRedirect: "Nach dem Löschen nutzen diese Regeln",
	delModalDeleteRules: "Diese Regeln löschen",
	cancel: "Abbrechen",
	confirmDelete: "Löschen bestätigen",

	clearVaultModalTitle: "Tresor-Nummerierung löschen",
	clearVaultTurnOffAuto: "Automatische Nummerierung ebenfalls ausschalten",
	clearVaultTurnOffAutoHint: "(damit die Nummern nicht sofort wieder hinzugefügt werden)",
	clearVaultModalBody:
		"Schaltet zuerst die globale automatische Nummerierung AUS und entfernt dann die Präfixe dieses Plugins aus allen Markdown-Dateien, sodass nur die Überschriften übrig bleiben (Links werden mit aktivem „Interne Links synchronisieren (Backlinks)“ mit angepasst). NICHT im Rückgängig-Verlauf von Obsidian – vorher ein Backup anlegen. Fortfahren?",
	confirmClearVault: "Tresor-Löschung bestätigen",

	freezeVaultModalTitle: "Nummerierung festschreiben und Besitz abgeben",
	freezeVaultModalBody:
		"Mit der Bestätigung: (1) Ihre Nummern bleiben unverändert als normaler Text erhalten; (2) die unsichtbaren Marker (U+2060) werden im ganzen Tresor entfernt – auch in Link-Ankern, [[Notiz#Überschrift]] bleibt also auflösbar; (3) das Plugin beendet jede automatische Nummerierung (hat Vorrang vor Frontmatter); (4) NICHT im Rückgängig-Verlauf – vorher ein Backup anlegen; (5) um später wieder zu übernehmen, zuerst „Fremde Nummerierung bereinigen“ ausführen, sonst wird ein neues Präfix aufgesetzt. Fortfahren?",
	confirmFreezeVault: "Festschreiben und Abgeben bestätigen",

	foreignGuardModalTitle: "Mögliche Nummerierung von außerhalb des Plugins",
	foreignGuardModalBody: (count) =>
		`Diese ${count} Überschrift(en) wirken nummeriert, doch das Plugin kann nicht sicher sein, dass Sie sie selbst geschrieben haben („API-Design“, „TODO-Liste“ usw. können Fehltreffer sein). Standardmäßig sind alle angehakt; ohne Haken bleibt der Text unverändert (das Plugin setzt trotzdem seine eigene Nummer davor):`,
	foreignGuardItemToggle: (before) => `Fremde Nummerierung in „${before}“ bereinigen`,
	foreignGuardSearchPlaceholder: "Überschriften suchen…",
	foreignGuardSearchEmpty: "Keine passenden Überschriften",

	cmdToggle: "Globale automatische Nummerierung umschalten",
	cmdRenumber: "Aktuelle Notiz neu nummerieren",
	cmdClear: "Nummerierung der aktuellen Notiz löschen",
	cmdClearForeign: "Fremde Überschrift-Nummerierung in der aktuellen Notiz bereinigen",
	cmdClearStale: "Restnummerierung der aktuellen Notiz löschen (Modus „Nur anzeigen“)",
	cmdCopyOutline: "Nummerierte Gliederung kopieren",
	cmdCopySectionLink: "Link zum aktuellen Abschnitt kopieren",
	cmdCopySectionEmbed: "Einbettungs-Link des aktuellen Abschnitts kopieren",
	cmdInsertToc: "Inhaltsverzeichnis einfügen",
	cmdToggleHeadingSkip: "Nummerierung der Überschrift am Cursor auslassen / wiederherstellen",
	cmdPromoteSection: "Aktuellen Abschnitt höherstufen",
	cmdDemoteSection: "Aktuellen Abschnitt herabstufen",
	cmdPromoteHeading: "Aktuelle Überschrift höherstufen (ohne Unterüberschriften)",
	cmdDemoteHeading: "Aktuelle Überschrift herabstufen (ohne Unterüberschriften)",
	cmdChooseNoteTemplate: "Vorlage für die aktuelle Notiz wählen…",
	cmdToggleNoteAuto: "Automatische Nummerierung der aktuellen Notiz umschalten",
	menuToggleSkip: "Nummerierung dieser Überschrift auslassen",
	menuToggleSkipTree: "Nummerierung des ganzen Abschnitts auslassen (mit Unterüberschriften)",
	menuCopySectionEmbed: "Abschnitts-Einbettung kopieren",
	cmdToggleSectionSkip:
		"Nummerierung des ganzen Abschnitts am Cursor auslassen / wiederherstellen",
	menuCopySectionLink: "Abschnitts-Link kopieren",
	menuAdjustHeading: "Ebene dieser Überschrift ändern",
	menuAdjustSection: "Ebene des Abschnitts ändern (mit Unterüberschriften)",
	menuNoteSettings: "Nummerierungseinstellungen dieser Notiz…",
	menuBack: "Zurück",
	handleHint: "Ziehen, um den Abschnitt zu verschieben · Rechtsklick für das Menü",
	handleHintReading: "Rechtsklick für Menü",
	noticeSectionShiftOutOfRange:
		"Eine Überschrift dieses Abschnitts würde die Ebenen 1–6 verlassen; nichts geändert",
	noticeNoteTemplateNoRule:
		"Für den Pfad dieser Notiz ist keine Nummerierung aktiv; legen Sie zuerst in den Einstellungen eine Pfadregel an",
	noticeNoteTemplateSet: (name) => `Diese Notiz nutzt jetzt die Vorlage „${name}“`,
	noticeNoteAutoOn: "Diese Notiz wird immer automatisch nummeriert",
	noticeNoteAutoOff: "Diese Notiz wird nicht automatisch nummeriert",
	noticeNoTemplates: "Keine Vorlagen verfügbar",
	chooseTemplatePlaceholder: "Vorlage für diese Notiz wählen…",
	chooseTemplateFollowRule: "(Pfadregel folgen – Einzelwahl dieser Notiz aufheben)",
	noticeNoteTemplateCleared: "Diese Notiz folgt wieder der Vorlage ihrer Pfadregel",
	statusModeWrite: "Schreiben",
	statusModeVirtual: "Nur anzeigen",
	statusNoNumbering: "Nicht nummeriert",
	statusPausedByNote: "Für Notiz pausiert",
	statusMenuRule: (path) => `Passende Regel: ${path}`,
	statusMenuNoRule: "Keine Pfadregel passt",
	statusMenuAutoFollow: "Automatische Nummerierung: global folgen",
	statusMenuAutoOn: "Automatische Nummerierung: für diese Notiz immer",
	statusMenuAutoOff: "Automatische Nummerierung: für diese Notiz nie",
	statusMenuChangeTemplate: "Vorlage wechseln…",
	statusMenuRenumber: "Jetzt neu nummerieren",
	statusMenuCopyOutline: "Nummerierte Gliederung kopieren",
	statusMenuClearStale: "Restnummerierung löschen",
	statusMenuCleanForeign: "Manuelle Nummerierung bereinigen…",
	noticeStaleCleared:
		"Alte, vom Plugin geschriebene Nummern entfernt; handgeschriebene blieben unberührt",
	noticeNoStaleNumbering: "Diese Datei enthält keine vom Plugin geschriebenen Nummern",
	virtualStaleTooltip:
		"Diese Datei enthält noch Nummern, die das Plugin früher geschrieben hat (Exporte, Publish und externe Editoren zeigen sie). Mit „Restliche Plugin-Nummerierung in dieser Datei löschen“ entfernen",

	noticeEnabled: "Globale automatische Nummerierung aktiviert",
	noticeDisabled: "Globale automatische Nummerierung deaktiviert",
	noticeNothingToClear: "Kein Nummernpräfix in der aktuellen Datei zu löschen",
	noticeCleared: "Nummerierung gelöscht",
	noticeClearedAndPaused:
		"Nummerierung gelöscht und automatische Nummerierung für diese Notiz pausiert (Eigenschaft obsidian-auto-headings: false); mit „Jetzt neu nummerieren“ fortsetzen.",
	noticeRenumberedAndResumed:
		"Neu nummeriert; automatische Nummerierung für diese Notiz wieder aktiv",
	noticeClearedVault: (count) => `Tresor-Nummerierung gelöscht (${count} Datei(en) geändert)`,
	noticeFrozenVault: (count) =>
		`Nummerierung festgeschrieben und Besitz abgegeben (${count} Datei(en) geändert); Nummern bleiben als normaler Text, automatische Nummerierung ist aus`,
	noticeResumed:
		"Nummerierung wird wieder verwaltet; falls noch festgeschriebene Nummern in Ihren Dateien stehen, führen Sie zuerst „Fremde Nummerierung bereinigen“ aus",
	noticeNoRule: "Die aktuelle Datei passt auf keine Pfadregel; Nummerierung nicht möglich",
	noticeNoNumberingRule: "Der Pfad dieser Datei steht auf „Keine Nummerierung“",
	noticeVirtualModeFile:
		"Diese Datei ist im Modus „Nur anzeigen“: Nummern erscheinen in Obsidian, werden aber nie in die Datei geschrieben",
	noticeBatchNoMatch: "Diese Regel passt derzeit auf keine Markdown-Datei",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Stapel-Neunummerierung fertig: ${changed} aktualisiert, ${unchanged} unverändert, ${skipped} übersprungen`,
	noticeRenumbered: "Neu nummeriert",
	noticeNoChange: "Keine Änderung nötig",
	noticeNoForeign: "Keine fremde Nummerierung in der aktuellen Datei zu bereinigen",
	noticeForeignCleared: "Fremde Überschrift-Nummerierung bereinigt",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Fertig: ${cleaned} bereinigt, ${kept} unverändert belassen und mit Nummerierung versehen`
			: `Fremde Überschrift-Nummerierung bereinigt (${cleaned})`,
	noticeBacklinksUpdated: (count) => `${count} interne(r) Link(s) aktualisiert`,
	noticeBacklinksIntro:
		"Auto Headings hat interne Links in anderen Dateien aktualisiert, die auf Überschriften dieser Datei zeigen (damit sie nicht brechen). Diese Änderungen stehen NICHT im Rückgängig-Verlauf der geänderten Dateien; unter Einstellungen → Allgemein lässt sich „Interne Links synchronisieren“ ausschalten. Wird nur einmal angezeigt.",
	noticeNoActiveFile: "Keine Markdown-Datei geöffnet",
	noticeNoHeadings: "Die aktuelle Datei hat keine Überschriften",
	noticeOutlineCopied: (count) =>
		`Nummerierte Gliederung kopiert (${count} Überschrift${count === 1 ? "" : "en"})`,
	noticeCopyFailed: "Kopieren in die Zwischenablage fehlgeschlagen",
	noticeSectionLinkCopied: (label) => `Link kopiert: ${label}`,
	noticeSectionEmbedCopied: (label) => `Einbettungs-Link kopiert: ${label}`,
	noticeForeignNumberingGuardAction: "Prüfen und bereinigen",
	noticeForeignGuardFileNotOpen:
		"Diese Datei ist in keinem Tab mehr geöffnet; öffnen Sie sie erneut, um sie zu bereinigen",
	pathNoMatchHint: "Notizen, auf die keine Regel passt, werden nicht nummeriert.",
	activeRuleTooltip: "Die aktuelle Notiz nutzt diese Regel",
	moreActionsTooltip: "Weitere Aktionen",
	templateBuiltinTag: "Eingebaut",
	templateCardUsage: (rules, whitelist) =>
		`Von ${rules} ${rules === 1 ? "Regel" : "Regeln"} genutzt · ${whitelist} ${whitelist === 1 ? "Ausnahme" : "Ausnahmen"}`,
	editBtn: "Bearbeiten",
	templateActionsTooltip: "Vorlagenaktionen",
	cardSampleTitles: [
		"Dokumenttitel",
		"Überblick",
		"Hintergrund",
		"Details",
		"Kernpunkt",
		"Hinweise",
	],
	editorKicker: "Vorlage bearbeiten",
	renameTemplateTooltip: "Vorlage umbenennen",
	editorTabFormat: "Format",
	editorTabWhitelist: "Ausnahmen",
	rangeLabel: "Bereich",
	rangeTo: "bis",
	startIndexLabel: "Beginnen bei",
	startIndexHint: "Mit 0 erhält man 0.1, 0.2…",
	moreRulesLabel: "Weitere Regeln",
	ancestorLabel: "Übergeordnete Nummern",
	skipLabel: "Bei übersprungener Ebene",
	placeholderLabel: "Platzhalter",
	colParents: "Übergeordnet",
	inheritNone: "Keine",
	inheritLevels: (n) => `${n} ${n === 1 ? "Ebene" : "Ebenen"}`,
	outOfRangeBefore: (top) =>
		`Außerhalb des Nummerierungsbereichs (Nummerierung beginnt bei H${top})`,
	outOfRangeAfter: (bottom) =>
		`Außerhalb des Nummerierungsbereichs (Nummerierung endet bei H${bottom})`,
	previewTitle: "Vorschau",
	previewSample: "Beispiel",
	previewCurrent: "Aktuelle Notiz",
	previewNoHeadings: "Diese Notiz hat noch keine Überschriften.",
	previewTagWhitelist: "Ausnahme",
	previewTagSkip: "Übersprungen",
	previewTagUnnumbered: "Nicht nummeriert",
	previewSampleWords: [
		"Dokumenttitel",
		"Überblick",
		"Hintergrund",
		"Motivation",
		"Details",
		"Hinweise",
		"Methode",
		"Fazit",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`Änderungen wirken sofort · betrifft ${notes} ${notes === 1 ? "Notiz" : "Notizen"} unter ${rules} ${rules === 1 ? "Regel" : "Regeln"}, davon ${writeNotes} in Dateien geschrieben.`,
	footerUnused: "Änderungen wirken sofort · noch keine Pfadregel nutzt diese Vorlage.",
	footerWhitelist: "Änderungen wirken sofort · auf ein Wort klicken zum Bearbeiten.",
	doneBtn: "Fertig",
	editorQuickApply: "Schnell anwenden",
	editorHistory: "Verlauf",
	quickRecentHeading: "Zuletzt verwendete Stile",
	quickPresetHeading: "Gängige Nummerierungsschemata",
	quickNoRecent: "Noch keine gespeicherten Stile",
	presetDecimal: "Dezimal · 1 / 1.1 / 1.1.1",
	presetChapter: "Kapitel · 第一章 / 第一节",
	presetOfficial: "Amtlich · 一、/（一）/ 1.",
	presetLegal: "Rechtlich · 第一编 / 第一章 / 第一条",
	presetOutline: "Gliederung · I. / A. / 1.",
	historyTitle: (name) => `Stilverlauf von „${name}“`,
	historyEmpty:
		"Noch kein Verlauf – beim Schließen des Editors nach einer Stiländerung wird hier ein Schnappschuss abgelegt.",
	historyRestore: "Wiederherstellen",
	historyCurrent: "Wie aktuell",
	wlLegendIntro: "Passende Überschriften werden nicht nummeriert und verbrauchen keine Nummer:",
	wlLegendExact: "exakt",
	wlLegendPartial: "enthält das Wort",
	wlLegendSubtree: "ganzer Abschnitt ausgenommen, danach geht die Nummerierung weiter",
	maintVaultHeading: "Ganzer Tresor",
	maintVaultMeta: "Nicht rückgängig zu machen – vorher Backup anlegen",
	noticeStaleNotVirtual:
		"Diese Notiz ist nicht im Modus „Nur anzeigen“ und hat daher keine Restnummerierung.",
	confirmWordPrompt: (word) => `Zur Bestätigung „${word}“ eingeben`,
	clearVaultWord: "löschen",
	freezeVaultWord: "festschreiben",
	aboutDescription:
		"Nummeriert Überschriften anhand von Vorlagen – nur angezeigt oder in die Notiz geschrieben – und hält Links synchron, wenn sich Überschriften ändern.",
	foreignGuardSelectAll: "Alle auswählen",
	foreignGuardSelected: (selected, total) => `${selected} von ${total} ausgewählt`,
	foreignGuardUndoHint: "Änderungen an dieser Notiz lassen sich mit Strg+Z rückgängig machen",
	foreignGuardConfirmCount: (count) => `${count} bereinigen`,
	noticeForeignGuardCount: (count, virtual) =>
		`Diese Notiz hat ${count} Überschrift(en), die wie handgeschriebene Nummerierung aussehen; diesmal wurde nicht ${virtual ? "angezeigt" : "automatisch nummeriert"}.`,
};

export default de;
