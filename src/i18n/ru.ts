// ru 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** 俄语复数形：1 → one，2–4 → few，其余（含 11–14）→ many。 */
function pluralRu(n: number, one: string, few: string, many: string): string {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) {
		return one;
	}
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) {
		return few;
	}
	return many;
}

/** Русский; отсутствующие ключи берутся из английского. */
const ru: Partial<Messages> = {
	tabGeneral: "Общие",
	tabTemplates: "Пути и шаблоны",
	tabMaintenance: "Обслуживание",
	tabAbout: "О плагине",

	languageName: "Язык",
	languageDesc: "Язык настроек и команд.",
	langAuto: "Авто (как в Obsidian)",
	languageChangeHint: "Названия команд обновятся после перезагрузки плагина.",

	autoNumberName: "Глобальная автонумерация",
	autoNumberDesc: "Нумерует заголовки при правке; если выключено — «Перенумеровать сейчас».",

	debounceName: "Задержка",
	debounceDesc: (min, max, def) =>
		`Пауза после ввода перед нумерацией (${min}–${max} мс, по умолчанию ${def}).`,
	resetTooltip: (def) => `Сбросить на значение по умолчанию (${def} мс)`,

	updateBacklinksName: "Синхронизировать внутренние ссылки (обратные ссылки)",
	updateBacklinksDesc:
		"При изменении текста заголовка обновляет ссылки на него в других заметках.",

	headingLinkSuggestName: "Подсказывать ссылки на заголовки при вводе",
	headingLinkSuggestDesc: "Предлагает заголовки хранилища по мере ввода; Tab вставляет ссылку.",
	headingSuggestThisFile: "(этот файл)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Хранилище слишком большое: индекс заголовков построен частично (проиндексировано: ${indexed}); подсказки работают в пределах индекса.`,
	vcTargetName: "Показывать подсказки в",
	vcTargetDesc: "Окно этого плагина перекрывает окно VC; с VC заголовки попадают в его окно.",
	vcTargetPlugin: "Окно этого плагина",
	vcTargetVc: "Окно Various Complements",

	sectionInterface: "Интерфейс",
	sectionNumbering: "Автонумерация",
	sectionLinking: "Обслуживание ссылок",
	sectionSuggest: "Подсказки ссылок на заголовки",
	sectionNoteEntry: "Меню",
	headingMenuName: "Меню заголовка",
	headingMenuDesc:
		"Правый клик по стрелке слева от заголовка: сменить уровень, пропустить нумерацию, скопировать ссылку.",
	statusBarMenuName: "Меню строки состояния",
	statusBarMenuDesc:
		"Строка состояния показывает нумерацию заметки; по клику можно сменить автонумерацию или шаблон.",

	vcNotInstalledNotice:
		"Various Complements не найден (не установлен или отключён); автонастройка отменена. Установите и включите его или используйте ручную настройку.",
	vcDictionaryPathLabel: "Путь к файлу словаря",
	vcCopyPathButton: "Скопировать путь",
	noticeVcPathCopied: "Путь к файлу словаря скопирован.",
	vcManualConfirmTitle: "Включить ручную интеграцию",
	vcManualConfirmBody:
		"В папке плагина будет создан и обновляться словарь заголовков (настройки VC не меняются). Скопируйте путь в «Custom dictionary paths» в VC и включите «Custom dictionary complement»; рекомендуется очистить «Displayed text suffix», иначе кандидаты будут выглядеть как «заголовок => ...».",
	vcManualConfirmButton: "Создать словарь",
	vcAutoConfirmTitle: "Включить автоматическую интеграцию",
	vcAutoConfirmBody:
		"Будет создан словарь заголовков и автоматически настроен VC (с проверками безопасности; если безопасно записать нельзя, всё отменяется без изменения настроек VC). Продолжить?",
	vcAutoConfirmPoints: [
		"Создавать и обновлять словарь заголовков (не более 20 000)",
		"Записать в настройки VC: путь к словарю, «Custom dictionary complement» и порог срабатывания не менее 2 символов",
		"Очистить «Displayed text suffix» в VC (глобально: затронет и другие ваши словари)",
		"Поднять «Max number of suggestions» в VC минимум до 10 (глобально; только повышается)",
		"Перезагрузить словари VC после записи (о сбое сообщим отдельно)",
	],
	vcDescriptionOffHint:
		"VC скрывает строку источника кандидата (Description on suggestion: None).",
	vcOffConfirmTitle: "Остановить интеграцию словаря",
	vcOffConfirmBody:
		"Словарь заголовков больше не будет обновляться. Various Complements всё ещё его загружает — убрать и из VC? Если оставить, VC продолжит использовать устаревший словарь (переименованные заголовки могут вставлять нерабочие ссылки).",
	vcOffKeepButton: "Оставить",
	vcOffRemoveButton: "Убрать из VC",
	vcStaleDictName: "VC всё ещё загружает старый словарь заголовков",
	vcStaleDictDesc:
		"Он больше не обновляется; переименованные заголовки могут вставлять нерабочие ссылки.",
	vcStaleDictRemoveButton: "Убрать",
	noticeVcDictRemoved: "Словарь заголовков этого плагина удалён из Various Complements.",
	noticeVcDictRemoveFailed:
		"Не удалось прочитать настройки Various Complements. Удалите этот путь к словарю вручную в настройках VC.",
	vcAutoConfirmButton: "Подтвердить и настроить",
	vcAutoManualButton: "Ручная настройка",
	noticeVcAutoWriteSuccess: "Интеграция с Various Complements настроена автоматически.",
	noticeVcAutoWriteInvalidShape:
		"Формат конфигурации VC не соответствует ожидаемому; автозапись отменена (настройки VC не тронуты). Используйте ручную настройку или проверьте конфигурацию VC.",
	noticeVcAutoWriteNotInstalled:
		"Не удалось настроить VC автоматически (не установлен, отключён или нет файла данных); установите и включите его или используйте ручную настройку.",
	noticeVcReloadFailed:
		"Словарь и настройки VC записаны, но перезагрузить словари не удалось; выполните команду VC «Reload custom dictionaries» (или перезапустите Obsidian).",
	noticeVcDictionaryTruncated: (total) =>
		`Общее число заголовков (${total}) превышает лимит словаря; он усечён и работает в пределах включённого.`,

	pathRulesHeading: "Правила путей",
	pathRulesDesc:
		"Сопоставляет пути с шаблонами: правила папок оканчиваются на «/», корневое правило «/» — глобальное по умолчанию, побеждает самое конкретное.",
	pathNoRootWarn:
		"⚠ Нет корневого правила пути (/). При включённой глобальной автонумерации файлы, не подходящие ни под одно правило, не нумеруются.",
	addRootRule: "+ Добавить корневое правило /",
	addRule: "Добавить правило",
	pathColPattern: "Путь",
	pathColTemplate: "Шаблон",
	pathEmpty: "(Правил пока нет; добавьте корневое правило «/», чтобы охватить всё хранилище.)",
	pathInputPlaceholder: "напр. Проекты/ или Заметки/Глубокая работа.md или /",
	templateMissingSuffix: (name) => `${name} (не найден)`,
	clearInputTooltip: "Очистить этот путь",
	deleteRuleTooltip: "Удалить это правило",
	dragHandleTooltip: "Перетащите для сортировки",
	pathDuplicateWarn: (otherRow) =>
		`Этот путь уже занят правилом № ${otherRow}; одному пути соответствует один шаблон. Измените или удалите одно из правил.`,
	pathSuggestEmptyFolder: "(Эта папка пуста)",
	pathSuggestBackTooltip: "На уровень выше",
	pathSuggestDescendTooltip: "Показать содержимое",
	pathSuggestSelectHereTooltip: "Выбрать этот уровень",
	pathTemplateNone: "Без нумерации",
	batchRenumberTooltip: "Пакетная перенумерация: перенумеровать все файлы этого правила",
	batchRenumberNoneTooltip: "Для этого правила выбрано «Без нумерации» — перенумеровывать нечего",
	batchModalTitle: "Пакетная перенумерация",
	batchModalBody: (pattern, count) =>
		`Перенумерует файлы Markdown, подходящие под «${pattern}» (${count}), по их действующим шаблонам. ` +
		"Файлы «Без нумерации», отключённые во frontmatter или с чужой нумерацией, которую плагин не принял, пропускаются; " +
		"для открытых файлов доступна отмена, закрытые перезаписываются напрямую.",
	batchModalConfirm: "Перенумеровать",
	batchModalCancel: "Отмена",
	pathColMode: "Нумерация",
	pathModeWrite: "Запись в файл",
	pathModeVirtual: "Только показ",
	pathModeTooltip:
		"Запись в файл: номера записываются в заметку и видны во внешних редакторах, на GitHub и в Publish. Только показ: номера видны лишь в Obsidian, заметка не меняется.",
	batchRenumberVirtualTooltip:
		"Это правило «Только показ» — номера не записываются, перенумеровывать нечего",
	modeModalTitle: "Смена режима нумерации",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`В файлах (${count}) есть номера, записанные этим плагином, и он перестанет в них писать ` +
		`(в «Только показ» перейдут ${toVirtual}, без нумерации — ${toNone}).`,
	modeModalClearLabel:
		"Удалить номера, записанные плагином в эти файлы (ручные номера не затрагиваются). Если не отмечено, номера останутся; файлы в режиме «Только показ» отметят их как остаточные.",
	modeModalEntering: (count) =>
		`Файлов, переходящих из «Только показ» в «Запись в файл»: ${count}.`,
	modeModalWriteLabel:
		"Записать номера в эти файлы сейчас (иначе — при следующей правке; открытые файлы обновятся сразу)",
	modeModalConfirm: "Подтвердить",
	noticeModeCleared: (count) => `Номера плагина удалены из файлов: ${count}`,

	templatesHeading: "Шаблоны",
	templatesDesc:
		"Задаёт формат нумерации и список исключений для каждого уровня заголовков; какой файл использует какой шаблон — определяют правила путей выше.",
	addTemplate: "Новый шаблон",
	deleteBtn: "Удалить",

	topLevelName: "Начальный уровень",
	bottomLevelName: "Конечный уровень",
	ancestorSelf: "Свой стиль (1.a.①)",
	ancestorArabic: "Только арабские (一 / 1.1)",

	colLevel: "Уровень",
	colPrefix: "Префикс",
	colNumeral: "Цифры",
	colNumberSep: "Разд. номера",
	colSuffix: "Суффикс",
	colTitleSep: "Разд. заголовка",
	colPreview: "Просмотр",
	inheritDepthAll: "Все",
	previewHeadingWord: "Заголовок",

	skipFillFill: "Заполнять",
	skipFillDrop: "Пропустить (убрать сегмент)",
	skipFillNone: "Не нумеровать (оставить как есть)",

	matchExact: "Точно",
	matchPartial: "Частично",
	matchSubtree: "Поддерево",

	wlInputPlaceholder: "Введите слово и нажмите Enter…",
	wlFilterPlaceholder: "Фильтр записей…",
	wlSortAdded: "По порядку добавления",
	wlSortAz: "А–Я",
	wlSortMatch: "По типу совпадения",
	wlFilterNoMatch: "(Нет записей, подходящих под фильтр)",
	wlEmpty:
		"Записей пока нет — введите слово выше и нажмите Enter; подходящие заголовки не нумеруются.",
	wlEditTitle: "Нажмите, чтобы изменить",
	wlChipWarnTitle:
		"У подходящего заголовка есть подзаголовки; они остаются нумерованными и прикрепятся к предыдущему нумерованному предку. Используйте «Поддерево», чтобы исключить весь блок.",
	wlPreviewNoFile:
		"(Откройте файл Markdown с заголовками, чтобы увидеть совпадения этого списка.)",
	wlPreviewNone: "В текущем файле этот список не исключает ни одного заголовка.",
	wlPreviewSome: (count, titles) =>
		`Этот список исключит из текущего файла заголовков: ${count} — ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ По правилам путей этот файл на самом деле использует шаблон «${appliedName}», а не тот, что вы правите; просмотр ниже условный.`,
	wlPreviewNoTemplate:
		"⚠ Текущий файл не подходит ни под одно правило пути и не будет нумероваться автоматически; просмотр ниже условный.",

	clearVaultName: "Очистить нумерацию во всём хранилище",
	clearVaultDesc: "Убирает номера этого плагина из всех заметок и выключает автонумерацию.",
	clearVaultBtn: "Очистить нумерацию хранилища…",
	freezeVaultName: "Зафиксировать нумерацию и передать владение",
	freezeVaultDesc: "Оставляет номера, убирает невидимые метки, останавливает нумерацию.",
	freezeVaultBtn: "Зафиксировать нумерацию…",
	retiredBannerTitle: "Плагин передал владение вашей нумерацией",
	retiredBannerBody:
		"Номера остались обычным текстом, а плагин сейчас ничего не нумерует автоматически. Чтобы вернуть управление: нажмите кнопку ниже, затем выполните «Убрать чужую нумерацию» для нужных файлов, иначе имеющиеся номера задвоятся с новым префиксом.",
	resumeBtn: "Возобновить управление нумерацией",

	aboutLinkRepo: "Репозиторий GitHub",
	aboutLinkIssues: "Сообщить о проблеме",

	aboutCreditsHeading: "Благодарности",
	aboutCreditsIntro: "При разработке использовались идеи этих плагинов с открытым кодом.",
	aboutCreditPathSuggest: "Подсказки папок и файлов и сопоставление при вводе пути",
	aboutCreditBacklinks: "Первоначальный образец синхронизации обратных ссылок",
	aboutCreditWordJoiner: "Первоначальный образец пометки номеров невидимыми символами",

	defaultTemplateDisplay: "По умолчанию",

	delModalTitle: (name) => `Удалить шаблон «${name}»`,
	delModalBody: (count) => `Этот шаблон используют правила путей (${count}):`,
	delModalEmptyPath: "(пустой путь)",
	delModalRedirect: "После удаления эти правила будут использовать",
	delModalDeleteRules: "Удалить эти правила",
	cancel: "Отмена",
	confirmDelete: "Подтвердить удаление",

	clearVaultModalTitle: "Очистить нумерацию хранилища",
	clearVaultTurnOffAuto: "Также выключить автонумерацию",
	clearVaultTurnOffAutoHint: "(чтобы номера не добавились снова)",
	clearVaultModalBody:
		"Сначала ВЫКЛЮЧИТ глобальную автонумерацию, затем уберёт префиксы этого плагина из всех файлов Markdown, оставив чистые заголовки (ссылки тоже обновятся, если включено «Синхронизировать внутренние ссылки (обратные ссылки)»). НЕ попадает в историю отмены Obsidian — сначала сделайте резервную копию. Продолжить?",
	confirmClearVault: "Подтвердить очистку хранилища",

	freezeVaultModalTitle: "Зафиксировать нумерацию и передать владение",
	freezeVaultModalBody:
		"После подтверждения: (1) номера остаются как есть, становясь обычным текстом; (2) невидимые метки (U+2060) удаляются во всём хранилище, в том числе из якорей ссылок, так что [[заметка#заголовок]] по-прежнему работает; (3) плагин прекращает всю автоматическую нумерацию (приоритет над frontmatter); (4) НЕ попадает в историю отмены — сначала сделайте резервную копию; (5) чтобы позже вернуть управление, сначала выполните «Убрать чужую нумерацию», иначе сверху добавится новый префикс. Продолжить?",
	confirmFreezeVault: "Подтвердить фиксацию и передачу",

	foreignGuardModalTitle: "Возможная нумерация не от плагина",
	foreignGuardModalBody: (count) =>
		`Заголовки (${count}) выглядят пронумерованными, но плагин не уверен, что вы написали номера сами («Дизайн API», «TODO-список» и т. п. могут оказаться ложными срабатываниями). По умолчанию отмечены все; если снять отметку, текст останется как есть (плагин всё равно добавит свою нумерацию):`,
	foreignGuardItemToggle: (before) => `Убрать чужую нумерацию в «${before}»`,
	foreignGuardSearchPlaceholder: "Поиск заголовков…",
	foreignGuardSearchEmpty: "Подходящих заголовков нет",

	cmdToggle: "Переключить глобальную автонумерацию",
	cmdRenumber: "Перенумеровать текущую заметку",
	cmdClear: "Очистить нумерацию текущей заметки",
	cmdClearForeign: "Убрать чужую нумерацию заголовков в текущей заметке",
	cmdClearStale: "Очистить остаточную нумерацию текущей заметки (режим «Только показ»)",
	cmdCopyOutline: "Копировать нумерованный план",
	cmdCopySectionLink: "Копировать ссылку на текущий раздел",
	cmdCopySectionEmbed: "Копировать встраиваемую ссылку на текущий раздел",
	cmdInsertToc: "Вставить оглавление",
	cmdToggleHeadingSkip: "Пропустить / вернуть нумерацию заголовка под курсором",
	cmdPromoteSection: "Повысить текущий раздел",
	cmdDemoteSection: "Понизить текущий раздел",
	cmdPromoteHeading: "Повысить текущий заголовок (без подзаголовков)",
	cmdDemoteHeading: "Понизить текущий заголовок (без подзаголовков)",
	cmdChooseNoteTemplate: "Выбрать шаблон для текущей заметки…",
	cmdToggleNoteAuto: "Переключить автонумерацию текущей заметки",
	menuToggleSkip: "Пропустить нумерацию этого заголовка",
	menuToggleSkipTree: "Пропустить нумерацию всего раздела (с подзаголовками)",
	menuCopySectionEmbed: "Копировать встраивание раздела",
	cmdToggleSectionSkip: "Пропустить / вернуть нумерацию всего раздела под курсором",
	menuCopySectionLink: "Копировать ссылку на раздел",
	menuAdjustHeading: "Изменить уровень этого заголовка",
	menuAdjustSection: "Изменить уровень раздела (с подзаголовками)",
	menuNoteSettings: "Настройки нумерации этой заметки…",
	menuBack: "Назад",
	handleHint: "Перетащите, чтобы переместить раздел · правая кнопка — меню",
	handleHintReading: "Правый клик — меню",
	noticeSectionShiftOutOfRange:
		"Заголовок в этом разделе вышел бы за уровни 1–6; ничего не изменено",
	noticeNoteTemplateNoRule:
		"Для пути этой заметки нумерация не включена; сначала добавьте правило пути в настройках",
	noticeNoteTemplateSet: (name) => `Эта заметка теперь использует шаблон «${name}»`,
	noticeNoteAutoOn: "Эта заметка всегда нумеруется автоматически",
	noticeNoteAutoOff: "Эта заметка не нумеруется автоматически",
	noticeNoTemplates: "Нет доступных шаблонов",
	chooseTemplatePlaceholder: "Выберите шаблон для этой заметки…",
	chooseTemplateFollowRule:
		"(Следовать правилу пути — сбросить индивидуальную настройку заметки)",
	noticeNoteTemplateCleared: "Эта заметка снова использует шаблон своего правила пути",
	statusModeWrite: "Запись",
	statusModeVirtual: "Только показ",
	statusNoNumbering: "Без нумерации",
	statusPausedByNote: "Приостановлено для заметки",
	statusMenuRule: (path) => `Подходящее правило: ${path}`,
	statusMenuNoRule: "Ни одно правило пути не подходит",
	statusMenuAutoFollow: "Автонумерация: как глобально",
	statusMenuAutoOn: "Автонумерация: всегда для этой заметки",
	statusMenuAutoOff: "Автонумерация: никогда для этой заметки",
	statusMenuChangeTemplate: "Сменить шаблон…",
	statusMenuRenumber: "Перенумеровать сейчас",
	statusMenuCopyOutline: "Копировать нумерованный план",
	statusMenuClearStale: "Очистить остаточную нумерацию",
	statusMenuCleanForeign: "Очистить ручную нумерацию…",
	noticeStaleCleared: "Старые номера, записанные плагином, удалены; ручные номера не тронуты",
	noticeNoStaleNumbering: "В этом файле нет номеров, записанных плагином",
	virtualStaleTooltip:
		"В файле остались номера, записанные плагином ранее (экспорт, Publish и внешние редакторы их покажут). Выполните «Очистить остаточную нумерацию плагина в этом файле», чтобы убрать их",

	noticeEnabled: "Глобальная автонумерация включена",
	noticeDisabled: "Глобальная автонумерация выключена",
	noticeNothingToClear: "В текущем файле нет префикса нумерации для очистки",
	noticeCleared: "Нумерация очищена",
	noticeClearedAndPaused:
		"Нумерация очищена, автонумерация для этой заметки приостановлена (свойство obsidian-auto-headings: false); выполните «Перенумеровать сейчас», чтобы возобновить.",
	noticeRenumberedAndResumed: "Перенумеровано; автонумерация для этой заметки возобновлена",
	noticeClearedVault: (count) => `Нумерация хранилища очищена (изменено файлов: ${count})`,
	noticeFrozenVault: (count) =>
		`Нумерация зафиксирована, владение передано (изменено файлов: ${count}); номера остались обычным текстом, автонумерация выключена`,
	noticeResumed:
		"Управление нумерацией возобновлено; если в файлах остались зафиксированные номера, сначала выполните «Убрать чужую нумерацию»",
	noticeNoRule: "Текущий файл не подходит ни под одно правило пути; нумеровать нельзя",
	noticeNoNumberingRule: "Для пути этого файла выбрано «Без нумерации»",
	noticeVirtualModeFile:
		"Этот файл в режиме «Только показ»: номера видны в Obsidian, но в файл не записываются",
	noticeBatchNoMatch: "Сейчас это правило не подходит ни одному файлу Markdown",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Пакетная перенумерация завершена: обновлено ${changed}, без изменений ${unchanged}, пропущено ${skipped}`,
	noticeRenumbered: "Перенумеровано",
	noticeNoChange: "Изменения не нужны",
	noticeNoForeign: "В текущем файле нет чужой нумерации для очистки",
	noticeForeignCleared: "Чужая нумерация заголовков убрана",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Готово: очищено ${cleaned}, оставлено как есть с добавлением нумерации ${kept}`
			: `Чужая нумерация заголовков убрана (${cleaned})`,
	noticeBacklinksUpdated: (count) => `Обновлено внутренних ссылок: ${count}`,
	noticeBacklinksIntro:
		"Auto Headings обновил внутренние ссылки в других файлах, указывающие на заголовки этого файла (чтобы они не ломались). Эти правки НЕ попадают в историю отмены изменённых файлов; «Синхронизировать внутренние ссылки» можно выключить в Настройки → Общие. Показывается один раз.",
	noticeNoActiveFile: "Нет открытого файла Markdown",
	noticeNoHeadings: "В текущем файле нет заголовков",
	noticeOutlineCopied: (count) => `Нумерованный план скопирован (заголовков: ${count})`,
	noticeCopyFailed: "Не удалось скопировать в буфер обмена",
	noticeSectionLinkCopied: (label) => `Ссылка скопирована: ${label}`,
	noticeSectionEmbedCopied: (label) => `Встраиваемая ссылка скопирована: ${label}`,
	noticeForeignNumberingGuardAction: "Проверить и очистить",
	noticeForeignGuardFileNotOpen:
		"Файл больше не открыт ни в одной вкладке; откройте его снова, чтобы очистить",
	pathNoMatchHint: "Заметки, не подходящие ни под одно правило, не нумеруются.",
	activeRuleTooltip: "Текущая заметка использует это правило",
	moreActionsTooltip: "Ещё действия",
	templateBuiltinTag: "Встроенный",
	templateCardUsage: (rules, whitelist) =>
		`Используется в ${rules} ${pluralRu(rules, "правиле", "правилах", "правилах")} · ${whitelist} ${pluralRu(whitelist, "исключение", "исключения", "исключений")}`,
	editBtn: "Изменить",
	templateActionsTooltip: "Действия с шаблоном",
	cardSampleTitles: ["Название документа", "Обзор", "Контекст", "Детали", "Главное", "Заметки"],
	editorKicker: "Редактирование шаблона",
	renameTemplateTooltip: "Переименовать шаблон",
	editorTabFormat: "Формат",
	editorTabWhitelist: "Исключения",
	rangeLabel: "Диапазон",
	rangeTo: "по",
	startIndexLabel: "Начать с",
	startIndexHint: "Значение 0 даёт 0.1, 0.2…",
	moreRulesLabel: "Другие правила",
	ancestorLabel: "Номера родителей",
	skipLabel: "Если уровень пропущен",
	placeholderLabel: "Заполнитель",
	colParents: "Родители",
	inheritNone: "Нет",
	inheritLevels: (n) => `${n} ${pluralRu(n, "уровень", "уровня", "уровней")}`,
	outOfRangeBefore: (top) => `Вне диапазона нумерации (нумерация начинается с H${top})`,
	outOfRangeAfter: (bottom) => `Вне диапазона нумерации (нумерация заканчивается на H${bottom})`,
	previewTitle: "Просмотр",
	previewSample: "Пример",
	previewCurrent: "Текущая заметка",
	previewNoHeadings: "В этой заметке пока нет заголовков.",
	previewTagWhitelist: "Исключение",
	previewTagSkip: "Пропущен",
	previewTagUnnumbered: "Без номера",
	previewSampleWords: [
		"Название документа",
		"Обзор",
		"Контекст",
		"Мотивация",
		"Детали",
		"Заметки",
		"Метод",
		"Вывод",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`Изменения применяются сразу · затронуто заметок: ${notes} по правилам: ${rules}, из них записывается в файлы: ${writeNotes}.`,
	footerUnused:
		"Изменения применяются сразу · ни одно правило пути пока не использует этот шаблон.",
	footerWhitelist: "Изменения применяются сразу · нажмите на слово, чтобы изменить.",
	doneBtn: "Готово",
	editorQuickApply: "Быстро применить",
	editorHistory: "История",
	quickRecentHeading: "Недавно использованные стили",
	quickPresetHeading: "Распространённые схемы нумерации",
	quickNoRecent: "Сохранённых стилей пока нет",
	presetDecimal: "Десятичная · 1 / 1.1 / 1.1.1",
	presetChapter: "Главы · 第一章 / 第一节",
	presetOfficial: "Официальная · 一、/（一）/ 1.",
	presetLegal: "Юридическая · 第一编 / 第一章 / 第一条",
	presetOutline: "План · I. / A. / 1.",
	historyTitle: (name) => `История стилей «${name}»`,
	historyEmpty: "Истории пока нет — закрытие редактора после смены стиля оставит здесь снимок.",
	historyRestore: "Восстановить",
	historyCurrent: "Как текущий",
	wlLegendIntro: "Подходящие заголовки не нумеруются и не занимают номер:",
	wlLegendExact: "точно",
	wlLegendPartial: "содержит слово",
	wlLegendSubtree: "весь раздел исключён, дальше нумерация продолжается",
	maintVaultHeading: "Всё хранилище",
	maintVaultMeta: "Нельзя отменить — сначала сделайте резервную копию",
	noticeStaleNotVirtual:
		"Эта заметка не в режиме «Только показ», поэтому остаточной нумерации нет.",
	confirmWordPrompt: (word) => `Введите «${word}» для подтверждения`,
	clearVaultWord: "очистить",
	freezeVaultWord: "зафиксировать",
	aboutDescription:
		"Нумерует заголовки по шаблонам — только показывает или записывает в заметку — и синхронизирует ссылки при изменении заголовков.",
	foreignGuardSelectAll: "Выбрать все",
	foreignGuardSelected: (selected, total) => `Выбрано ${selected} из ${total}`,
	foreignGuardUndoHint: "Изменения в этой заметке можно отменить через Ctrl+Z",
	foreignGuardConfirmCount: (count) => `Очистить: ${count}`,
	noticeForeignGuardCount: (count, virtual) =>
		`В этой заметке заголовков, похожих на ручную нумерацию: ${count}; на этот раз нумерация не ${virtual ? "показана" : "применена"}.`,
	noticeNumberOnlyGuard: (virtual) =>
		`Заголовки в этой заметке сами являются номерами (например, «Глава 1»); на этот раз нумерация не ${virtual ? "показана" : "применена"}.`,
};

export default ru;
