// es 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** Español; las claves ausentes recurren al inglés. */
const es: Partial<Messages> = {
	tabGeneral: "General",
	tabTemplates: "Rutas y plantillas",
	tabMaintenance: "Mantenimiento",
	tabAbout: "Acerca de",

	languageName: "Idioma",
	languageDesc: "Idioma del panel de ajustes y de los comandos.",
	langAuto: "Automático (seguir Obsidian)",
	languageChangeHint: "Los nombres de los comandos se actualizan al recargar el complemento.",

	autoNumberName: "Numeración automática global",
	autoNumberDesc: "Numera los encabezados al editar; si está desactivada, usa «Renumerar ahora».",

	debounceName: "Retardo de espera",
	debounceDesc: (min, max, def) =>
		`Tiempo tras dejar de escribir antes de renumerar (${min}–${max} ms, por defecto ${def}).`,
	resetTooltip: (def) => `Restablecer a ${def} ms`,

	updateBacklinksName: "Sincronizar enlaces internos (backlinks)",
	updateBacklinksDesc:
		"Si cambia el texto de un encabezado, actualiza los enlaces a él en otras notas.",

	headingLinkSuggestName: "Sugerir enlaces a encabezados al escribir",
	headingLinkSuggestDesc:
		"Sugiere encabezados de la bóveda que coinciden con lo que escribes; Tab inserta un enlace.",
	headingSuggestThisFile: "(este archivo)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Bóveda demasiado grande: el índice de encabezados está incompleto (${indexed} indexados); las sugerencias funcionan dentro de lo indexado.`,
	vcTargetName: "Mostrar sugerencias en",
	vcTargetDesc:
		"El cuadro de este complemento tapa el de VC; con VC, los encabezados van en su cuadro.",
	vcTargetPlugin: "Cuadro de este complemento",
	vcTargetVc: "Cuadro de Various Complements",

	sectionInterface: "Interfaz",
	sectionNumbering: "Numeración automática",
	sectionLinking: "Mantenimiento de enlaces",
	sectionSuggest: "Sugerencias de enlaces a encabezados",
	sectionNoteEntry: "Menús",
	headingMenuName: "Menú de encabezados",
	headingMenuDesc:
		"Clic derecho en la flecha junto al encabezado: cambiar nivel, omitir numeración, copiar enlace.",
	statusBarMenuName: "Menú de la barra de estado",
	statusBarMenuDesc:
		"La barra de estado muestra la numeración de la nota; clic para cambiar numeración automática o plantilla.",

	vcNotInstalledNotice:
		"No se detectó Various Complements (no instalado o desactivado); configuración automática cancelada. Instálalo y actívalo, o usa la configuración manual.",
	vcDictionaryPathLabel: "Ruta del archivo de diccionario",
	vcCopyPathButton: "Copiar ruta",
	noticeVcPathCopied: "Ruta del archivo de diccionario copiada.",
	vcManualConfirmTitle: "Activar la integración manual",
	vcManualConfirmBody:
		"Se generará y mantendrá un diccionario de encabezados en la carpeta del complemento (no se modifica ningún ajuste de VC). Copia la ruta en «Custom dictionary paths» de VC y activa «Custom dictionary complement»; se recomienda vaciar «Displayed text suffix», o los candidatos se mostrarán como «encabezado => ...».",
	vcManualConfirmButton: "Generar diccionario",
	vcAutoConfirmTitle: "Activar la integración automática",
	vcAutoConfirmBody:
		"Se generará un diccionario de encabezados y se configurará VC automáticamente (con comprobaciones de seguridad; si no puede escribir con seguridad, se cancela sin tocar tus ajustes de VC). ¿Continuar?",
	vcAutoConfirmPoints: [
		"Generar y mantener el diccionario de encabezados (máximo 20 000)",
		"Escribir en VC: ruta del diccionario, «Custom dictionary complement» y umbral de al menos 2 caracteres",
		"Vaciar «Displayed text suffix» de VC (global: afecta también a tus otros diccionarios)",
		"Subir «Max number of suggestions» de VC a 10 como mínimo (global; solo se aumenta)",
		"Recargar los diccionarios de VC tras escribir (un fallo se avisa aparte)",
	],
	vcDescriptionOffHint:
		"VC oculta la línea de origen del candidato (Description on suggestion: None).",
	vcOffConfirmTitle: "Detener la integración del diccionario",
	vcOffConfirmBody:
		"El diccionario de encabezados dejará de actualizarse. Various Complements todavía lo carga; ¿quitarlo también de VC? Si lo conservas, VC seguirá usando este diccionario obsoleto (los encabezados renombrados pueden insertar enlaces rotos).",
	vcOffKeepButton: "Conservar",
	vcOffRemoveButton: "Quitar de VC",
	vcStaleDictName: "VC sigue cargando el diccionario antiguo",
	vcStaleDictDesc:
		"Ya no se actualiza; los encabezados renombrados pueden insertar enlaces rotos.",
	vcStaleDictRemoveButton: "Quitar",
	noticeVcDictRemoved:
		"Se quitó el diccionario de encabezados de este complemento de Various Complements.",
	noticeVcDictRemoveFailed:
		"No se pudieron leer los ajustes de Various Complements. Quita esta ruta de diccionario manualmente en los ajustes de VC.",
	vcAutoConfirmButton: "Confirmar y configurar",
	vcAutoManualButton: "Configuración manual",
	noticeVcAutoWriteSuccess: "Integración con Various Complements configurada automáticamente.",
	noticeVcAutoWriteInvalidShape:
		"El formato de la configuración de VC no coincide con lo esperado; escritura automática cancelada (sus ajustes no se tocaron). Usa la configuración manual o revisa la configuración de VC.",
	noticeVcAutoWriteNotInstalled:
		"No se pudo configurar VC automáticamente (no instalado, desactivado o sin archivo de datos); instálalo y actívalo, o usa la configuración manual.",
	noticeVcReloadFailed:
		"Se escribieron el diccionario y los ajustes de VC, pero falló la recarga; ejecuta el comando «Reload custom dictionaries» de VC (o reinicia Obsidian).",
	noticeVcDictionaryTruncated: (total) =>
		`El total de encabezados (${total}) supera el límite del diccionario; se truncó y funciona dentro de lo incluido.`,

	pathRulesHeading: "Reglas de ruta",
	pathRulesDesc:
		"Asigna rutas a plantillas: las reglas de carpeta terminan en «/», la regla raíz «/» es la predeterminada y gana la regla más específica.",
	pathNoRootWarn:
		"⚠ No hay regla de ruta raíz (/). Con la numeración automática global activada, los archivos sin regla no se numeran.",
	addRootRule: "+ Añadir regla raíz /",
	addRule: "Añadir regla",
	pathColPattern: "Ruta",
	pathColTemplate: "Plantilla",
	pathEmpty: "(Aún no hay reglas; añade una regla raíz «/» para cubrir toda la bóveda.)",
	pathInputPlaceholder: "p. ej. Proyectos/ o Notas/Trabajo profundo.md o /",
	templateMissingSuffix: (name) => `${name} (no existe)`,
	clearInputTooltip: "Borrar esta ruta",
	deleteRuleTooltip: "Eliminar esta regla",
	dragHandleTooltip: "Arrastrar para reordenar",
	pathDuplicateWarn: (otherRow) =>
		`Esta ruta ya la usa la regla n.º ${otherRow}; una ruta solo puede tener una plantilla. Edita o elimina una de ellas.`,
	pathSuggestEmptyFolder: "(Esta carpeta está vacía)",
	pathSuggestBackTooltip: "Subir un nivel",
	pathSuggestDescendTooltip: "Ver contenido",
	pathSuggestSelectHereTooltip: "Seleccionar este nivel",
	pathTemplateNone: "Sin numeración",
	batchRenumberTooltip: "Renumerar en lote: renumera todos los archivos de esta regla",
	batchRenumberNoneTooltip: "Esta regla es «Sin numeración»: no hay nada que renumerar",
	batchModalTitle: "Renumerar en lote",
	batchModalBody: (pattern, count) =>
		`Renumera ${count} archivo(s) Markdown que coinciden con «${pattern}», cada uno con su plantilla vigente. ` +
		"Se omiten los archivos «Sin numeración», desactivados por frontmatter o con numeración ajena sin asumir; " +
		"los archivos abiertos admiten deshacer, los cerrados se reescriben directamente.",
	batchModalConfirm: "Renumerar",
	batchModalCancel: "Cancelar",
	pathColMode: "Numeración",
	pathModeWrite: "Escribir en el archivo",
	pathModeVirtual: "Solo mostrar",
	pathModeTooltip:
		"Escribir en el archivo: los números se escriben en la nota y se ven en editores externos, GitHub y Publish. Solo mostrar: los números se ven dentro de Obsidian y la nota nunca cambia.",
	batchRenumberVirtualTooltip:
		"Esta regla es «Solo mostrar»: los números no se escriben, no hay nada que renumerar",
	modeModalTitle: "Cambio de modo de numeración",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} archivo(s) contienen números escritos por este complemento, que dejará de escribir en ellos ` +
		`(${toVirtual} pasan a solo mostrar, ${toNone} a sin numeración).`,
	modeModalClearLabel:
		"Eliminar los números que este complemento escribió en estos archivos (los números manuales no se tocan). Si no se marca, los números permanecen; los archivos de solo mostrar los señalarán como restos.",
	modeModalEntering: (count) =>
		`${count} archivo(s) pasarán de «Solo mostrar» a «Escribir en el archivo».`,
	modeModalWriteLabel:
		"Escribir los números en estos archivos ahora (si no, en la próxima edición; los archivos abiertos se actualizan al instante)",
	modeModalConfirm: "Confirmar",
	noticeModeCleared: (count) =>
		`Se eliminaron los números del complemento en ${count} archivo(s)`,

	templatesHeading: "Plantillas",
	templatesDesc:
		"Define el formato de numeración y la lista de exclusión por nivel de encabezado; qué archivo usa qué plantilla lo deciden las reglas de ruta de arriba.",
	addTemplate: "Nueva plantilla",
	deleteBtn: "Eliminar",

	topLevelName: "Nivel inicial",
	bottomLevelName: "Nivel final",
	ancestorSelf: "Estilo propio (1.a.①)",
	ancestorArabic: "Todo arábigo (一 / 1.1)",

	colLevel: "Nivel",
	colPrefix: "Prefijo",
	colNumeral: "Numeral",
	colNumberSep: "Sep. de número",
	colSuffix: "Sufijo",
	colTitleSep: "Sep. de título",
	colPreview: "Vista previa",
	inheritDepthAll: "Todos",
	previewHeadingWord: "Encabezado",

	skipFillFill: "Rellenar",
	skipFillDrop: "Omitir (suprimir el segmento)",
	skipFillNone: "No numerar (dejar igual)",

	matchExact: "Exacta",
	matchPartial: "Parcial",
	matchSubtree: "Subárbol",

	wlInputPlaceholder: "Escribe una palabra y pulsa Intro para añadir…",
	wlFilterPlaceholder: "Filtrar entradas…",
	wlSortAdded: "Por orden de adición",
	wlSortAz: "A–Z",
	wlSortMatch: "Por tipo de coincidencia",
	wlFilterNoMatch: "(Ninguna entrada coincide con el filtro)",
	wlEmpty:
		"Aún no hay entradas: escribe una palabra arriba y pulsa Intro; los encabezados coincidentes no se numeran.",
	wlEditTitle: "Haz clic para editar",
	wlChipWarnTitle:
		"El encabezado coincidente tiene subencabezados; estos siguen numerados y se colgarían del ancestro numerado anterior. Usa «Subárbol» para excluir todo el bloque.",
	wlPreviewNoFile:
		"(Abre un archivo Markdown con encabezados para previsualizar las coincidencias de esta lista.)",
	wlPreviewNone: "Ningún encabezado del archivo actual queda excluido por esta lista.",
	wlPreviewSome: (count, titles) =>
		`Esta lista excluirá ${count} encabezado(s) del archivo actual: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ Según las reglas de ruta, este archivo usa en realidad la plantilla «${appliedName}», no la que editas; la vista previa de abajo es hipotética.`,
	wlPreviewNoTemplate:
		"⚠ El archivo actual no coincide con ninguna regla de ruta y no se numerará automáticamente; la vista previa de abajo es hipotética.",

	clearVaultName: "Borrar la numeración de toda la bóveda",
	clearVaultDesc:
		"Quita la numeración de este complemento de todas las notas y desactiva la automática.",
	clearVaultBtn: "Borrar numeración de la bóveda…",
	freezeVaultName: "Fijar la numeración y ceder la propiedad",
	freezeVaultDesc:
		"Conserva los números, quita los marcadores invisibles y detiene la numeración.",
	freezeVaultBtn: "Fijar numeración…",
	retiredBannerTitle: "El complemento ha cedido la propiedad de tu numeración",
	retiredBannerBody:
		"Tus números permanecen como texto normal y el complemento no numera automáticamente. Para devolverle el control: pulsa el botón de abajo y ejecuta «Limpiar numeración ajena» en los archivos afectados; si no, los números existentes se acumularán con un prefijo nuevo.",
	resumeBtn: "Reanudar la gestión de la numeración",

	aboutLinkRepo: "Repositorio de GitHub",
	aboutLinkIssues: "Informar de un problema",

	aboutCreditsHeading: "Créditos",
	aboutCreditsIntro:
		"El desarrollo se inspiró en las ideas de estos complementos de código abierto.",
	aboutCreditPathSuggest: "Sugerencias de carpetas y archivos y coincidencia en la ruta",
	aboutCreditBacklinks: "Referencia original para la sincronización de backlinks",
	aboutCreditWordJoiner: "Referencia original para marcar números con caracteres invisibles",

	defaultTemplateDisplay: "Predeterminada",

	delModalTitle: (name) => `Eliminar la plantilla «${name}»`,
	delModalBody: (count) => `Estas ${count} regla(s) de ruta usan esta plantilla:`,
	delModalEmptyPath: "(ruta vacía)",
	delModalRedirect: "Tras eliminarla, estas reglas usarán",
	delModalDeleteRules: "Eliminar estas reglas",
	cancel: "Cancelar",
	confirmDelete: "Confirmar eliminación",

	clearVaultModalTitle: "Borrar la numeración de la bóveda",
	clearVaultTurnOffAuto: "Desactivar también la numeración automática",
	clearVaultTurnOffAutoHint: "(para que no se vuelvan a añadir enseguida)",
	clearVaultModalBody:
		"Primero DESACTIVA la numeración automática global y luego quita los prefijos de este complemento de todos los archivos Markdown, dejando los encabezados sin numerar (los enlaces también se actualizan si «Sincronizar enlaces internos (backlinks)» está activado). NO queda en el historial de deshacer de Obsidian: haz una copia antes. ¿Continuar?",
	confirmClearVault: "Confirmar borrado de la bóveda",

	freezeVaultModalTitle: "Fijar la numeración y ceder la propiedad",
	freezeVaultModalBody:
		"Al confirmar: (1) tus números se conservan tal cual, como texto normal; (2) se quitan los marcadores invisibles (U+2060) de toda la bóveda, también dentro de los anclajes de enlaces, así que [[nota#encabezado]] sigue resolviéndose; (3) el complemento detiene toda numeración automática (prevalece sobre el frontmatter); (4) NO queda en el historial de deshacer: haz una copia antes; (5) para retomar la gestión, ejecuta antes «Limpiar numeración ajena», o se acumulará un prefijo nuevo. ¿Continuar?",
	confirmFreezeVault: "Confirmar fijar y ceder",

	foreignGuardModalTitle: "Posible numeración ajena al complemento",
	foreignGuardModalBody: (count) =>
		`Estos ${count} encabezado(s) parecen numerados, pero el complemento no puede asegurar que los escribieras tú («Diseño de API», «Lista TODO», etc. pueden ser falsos positivos). Todos están marcados por defecto; al desmarcar uno se conserva su texto tal cual (el complemento añadirá igualmente su numeración):`,
	foreignGuardItemToggle: (before) => `Limpiar la numeración ajena de «${before}»`,
	foreignGuardSearchPlaceholder: "Buscar encabezados…",
	foreignGuardSearchEmpty: "No hay encabezados coincidentes",

	cmdToggle: "Alternar numeración automática global",
	cmdRenumber: "Renumerar la nota actual",
	cmdClear: "Borrar la numeración de la nota actual",
	cmdClearForeign: "Limpiar numeración ajena de encabezados en la nota actual",
	cmdClearStale: "Borrar numeración residual de la nota actual (modo solo mostrar)",
	cmdCopyOutline: "Copiar esquema numerado",
	cmdCopySectionLink: "Copiar enlace de la sección actual",
	cmdCopySectionEmbed: "Copiar enlace incrustado de la sección actual",
	cmdInsertToc: "Insertar tabla de contenidos",
	cmdToggleHeadingSkip: "Omitir / restaurar la numeración del encabezado bajo el cursor",
	cmdPromoteSection: "Subir de nivel la sección actual",
	cmdDemoteSection: "Bajar de nivel la sección actual",
	cmdPromoteHeading: "Subir el encabezado actual (sin subencabezados)",
	cmdDemoteHeading: "Bajar el encabezado actual (sin subencabezados)",
	cmdChooseNoteTemplate: "Elegir plantilla para la nota actual…",
	cmdToggleNoteAuto: "Alternar numeración automática de la nota actual",
	menuToggleSkip: "Omitir la numeración de este encabezado",
	menuToggleSkipTree: "Omitir la numeración de toda la sección (con subencabezados)",
	menuCopySectionEmbed: "Copiar sección incrustada",
	cmdToggleSectionSkip: "Omitir / restaurar la numeración de toda la sección bajo el cursor",
	menuCopySectionLink: "Copiar enlace de la sección",
	menuAdjustHeading: "Cambiar el nivel de este encabezado",
	menuAdjustSection: "Cambiar el nivel de la sección (con subencabezados)",
	menuNoteSettings: "Ajustes de numeración de esta nota…",
	menuBack: "Atrás",
	handleHint: "Arrastra para mover la sección · clic derecho para el menú",
	handleHintReading: "Clic derecho para el menú",
	noticeSectionShiftOutOfRange:
		"Un encabezado de esta sección saldría de los niveles 1–6; no se cambió nada",
	noticeNoteTemplateNoRule:
		"La ruta de esta nota no tiene numeración activada; añade antes una regla de ruta en los ajustes",
	noticeNoteTemplateSet: (name) => `Esta nota ahora usa la plantilla «${name}»`,
	noticeNoteAutoOn: "Esta nota se numerará siempre automáticamente",
	noticeNoteAutoOff: "Esta nota no se numerará automáticamente",
	noticeNoTemplates: "No hay plantillas disponibles",
	chooseTemplatePlaceholder: "Elige una plantilla para esta nota…",
	chooseTemplateFollowRule: "(Seguir la regla de ruta: quitar el ajuste propio de esta nota)",
	noticeNoteTemplateCleared: "Esta nota vuelve a usar la plantilla de su regla de ruta",
	statusModeWrite: "Escribir",
	statusModeVirtual: "Solo mostrar",
	statusNoNumbering: "Sin numerar",
	statusPausedByNote: "En pausa en la nota",
	statusMenuRule: (path) => `Regla aplicada: ${path}`,
	statusMenuNoRule: "Ninguna regla de ruta coincide",
	statusMenuAutoFollow: "Numeración automática: seguir la global",
	statusMenuAutoOn: "Numeración automática: siempre en esta nota",
	statusMenuAutoOff: "Numeración automática: nunca en esta nota",
	statusMenuChangeTemplate: "Cambiar plantilla…",
	statusMenuRenumber: "Renumerar ahora",
	statusMenuCopyOutline: "Copiar esquema numerado",
	statusMenuClearStale: "Borrar numeración residual",
	statusMenuCleanForeign: "Limpiar numeración manual…",
	noticeStaleCleared:
		"Se quitaron los números antiguos escritos por este complemento; los manuales no se tocaron",
	noticeNoStaleNumbering: "Este archivo no tiene números escritos por este complemento",
	virtualStaleTooltip:
		"Este archivo aún contiene números que el complemento escribió antes (las exportaciones, Publish y los editores externos los mostrarán). Ejecuta «Borrar numeración residual del complemento en este archivo» para quitarlos",

	noticeEnabled: "Numeración automática global activada",
	noticeDisabled: "Numeración automática global desactivada",
	noticeNothingToClear: "No hay prefijo de numeración que borrar en el archivo actual",
	noticeCleared: "Numeración borrada",
	noticeClearedAndPaused:
		"Numeración borrada y numeración automática en pausa para esta nota (propiedad obsidian-auto-headings: false); ejecuta «Renumerar ahora» para reanudarla.",
	noticeRenumberedAndResumed: "Renumerada; la numeración automática de esta nota se reanudó",
	noticeClearedVault: (count) =>
		`Numeración de la bóveda borrada (${count} archivo(s) modificados)`,
	noticeFrozenVault: (count) =>
		`Numeración fijada y propiedad cedida (${count} archivo(s) modificados); los números quedan como texto normal y la numeración automática se detiene`,
	noticeResumed:
		"Se retomó la gestión de la numeración; si quedan números fijados en tus archivos, ejecuta antes «Limpiar numeración ajena»",
	noticeNoRule: "El archivo actual no coincide con ninguna regla de ruta; no se puede numerar",
	noticeNoNumberingRule: "La ruta de este archivo está en «Sin numeración»",
	noticeVirtualModeFile:
		"Este archivo está en modo solo mostrar: los números se ven en Obsidian pero no se escriben en el archivo",
	noticeBatchNoMatch: "Esta regla no coincide actualmente con ningún archivo Markdown",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Renumeración en lote terminada: ${changed} actualizados, ${unchanged} sin cambios, ${skipped} omitidos`,
	noticeRenumbered: "Renumerada",
	noticeNoChange: "No hace falta ningún cambio",
	noticeNoForeign: "No hay numeración ajena que limpiar en el archivo actual",
	noticeForeignCleared: "Numeración ajena de encabezados limpiada",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Hecho: ${cleaned} limpiados, ${kept} conservados tal cual con numeración añadida`
			: `Numeración ajena de encabezados limpiada (${cleaned})`,
	noticeBacklinksUpdated: (count) => `${count} enlace(s) interno(s) actualizado(s)`,
	noticeBacklinksIntro:
		"Auto Headings actualizó los enlaces internos de otros archivos que apuntan a encabezados de este (para que no se rompan). Esos cambios NO están en el historial de deshacer de los archivos modificados; puedes desactivar «Sincronizar enlaces internos» en Ajustes → General. Se muestra una sola vez.",
	noticeNoActiveFile: "No hay ningún archivo Markdown abierto",
	noticeNoHeadings: "El archivo actual no tiene encabezados",
	noticeOutlineCopied: (count) =>
		`Esquema numerado copiado (${count} encabezado${count === 1 ? "" : "s"})`,
	noticeCopyFailed: "No se pudo copiar al portapapeles",
	noticeSectionLinkCopied: (label) => `Enlace copiado: ${label}`,
	noticeSectionEmbedCopied: (label) => `Enlace incrustado copiado: ${label}`,
	noticeForeignNumberingGuardAction: "Revisar y limpiar",
	noticeForeignGuardFileNotOpen:
		"Este archivo ya no está abierto en ninguna pestaña; ábrelo de nuevo para limpiarlo",
	pathNoMatchHint: "Las notas que no coinciden con ninguna regla no se numeran.",
	activeRuleTooltip: "La nota actual usa esta regla",
	moreActionsTooltip: "Más acciones",
	templateBuiltinTag: "Integrada",
	templateCardUsage: (rules, whitelist) =>
		`Usada por ${rules} ${rules === 1 ? "regla" : "reglas"} · ${whitelist} ${whitelist === 1 ? "entrada" : "entradas"} de exclusión`,
	editBtn: "Editar",
	templateActionsTooltip: "Acciones de la plantilla",
	cardSampleTitles: [
		"Título del documento",
		"Resumen",
		"Contexto",
		"Detalles",
		"Punto clave",
		"Notas",
	],
	editorKicker: "Editar plantilla",
	renameTemplateTooltip: "Renombrar plantilla",
	editorTabFormat: "Formato",
	editorTabWhitelist: "Exclusiones",
	rangeLabel: "Rango",
	rangeTo: "a",
	startIndexLabel: "Empezar en",
	startIndexHint: "Pon 0 para obtener 0.1, 0.2…",
	moreRulesLabel: "Más reglas",
	ancestorLabel: "Números superiores",
	skipLabel: "Cuando se salta un nivel",
	placeholderLabel: "Marcador",
	colParents: "Superiores",
	inheritNone: "Ninguno",
	inheritLevels: (n) => `${n} ${n === 1 ? "nivel" : "niveles"}`,
	outOfRangeBefore: (top) => `Fuera del rango de numeración (empieza en H${top})`,
	outOfRangeAfter: (bottom) => `Fuera del rango de numeración (termina en H${bottom})`,
	previewTitle: "Vista previa",
	previewSample: "Ejemplo",
	previewCurrent: "Nota actual",
	previewNoHeadings: "Esta nota aún no tiene encabezados.",
	previewTagWhitelist: "Exclusión",
	previewTagSkip: "Omitido",
	previewTagUnnumbered: "Sin numerar",
	previewSampleWords: [
		"Título del documento",
		"Resumen",
		"Contexto",
		"Motivación",
		"Detalles",
		"Notas",
		"Método",
		"Conclusión",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`Los cambios se aplican al instante · afecta a ${notes} ${notes === 1 ? "nota" : "notas"} de ${rules} ${rules === 1 ? "regla" : "reglas"}, ${writeNotes} escritas en el archivo.`,
	footerUnused:
		"Los cambios se aplican al instante · ninguna regla de ruta usa aún esta plantilla.",
	footerWhitelist: "Los cambios se aplican al instante · haz clic en una palabra para editarla.",
	doneBtn: "Hecho",
	editorQuickApply: "Aplicar rápido",
	editorHistory: "Historial",
	quickRecentHeading: "Estilos usados recientemente",
	quickPresetHeading: "Esquemas de numeración habituales",
	quickNoRecent: "Aún no hay estilos guardados",
	presetDecimal: "Decimal · 1 / 1.1 / 1.1.1",
	presetChapter: "Capítulos · 第一章 / 第一节",
	presetOfficial: "Oficial · 一、/（一）/ 1.",
	presetLegal: "Jurídico · 第一编 / 第一章 / 第一条",
	presetOutline: "Esquema · I. / A. / 1.",
	historyTitle: (name) => `Historial de estilos de «${name}»`,
	historyEmpty:
		"Aún no hay historial: al cerrar el editor tras cambiar un estilo se guarda aquí una instantánea.",
	historyRestore: "Restaurar",
	historyCurrent: "Igual que el actual",
	wlLegendIntro: "Los encabezados coincidentes no se numeran ni consumen número:",
	wlLegendExact: "exacta",
	wlLegendPartial: "contiene la palabra",
	wlLegendSubtree: "toda la sección excluida; la numeración se reanuda después",
	maintVaultHeading: "Toda la bóveda",
	maintVaultMeta: "No se puede deshacer: haz una copia antes",
	noticeStaleNotVirtual:
		"Esta nota no está en modo solo mostrar, así que no tiene numeración residual.",
	confirmWordPrompt: (word) => `Escribe «${word}» para confirmar`,
	clearVaultWord: "borrar",
	freezeVaultWord: "fijar",
	aboutDescription:
		"Numera los encabezados a partir de plantillas (solo mostrar o escritos en la nota) y mantiene los enlaces sincronizados cuando cambian.",
	foreignGuardSelectAll: "Seleccionar todo",
	foreignGuardSelected: (selected, total) => `${selected} de ${total} seleccionados`,
	foreignGuardUndoHint: "Los cambios en esta nota se pueden deshacer con Ctrl+Z",
	foreignGuardConfirmCount: (count) => `Limpiar ${count}`,
	noticeForeignGuardCount: (count, virtual) =>
		`Esta nota tiene ${count} encabezado(s) que parecen numerados a mano; esta vez no se ${virtual ? "mostró" : "aplicó"} numeración.`,
};

export default es;
