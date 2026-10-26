// fr 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** Français ; les clés absentes retombent sur l'anglais. */
const fr: Partial<Messages> = {
	tabGeneral: "Général",
	tabTemplates: "Chemins et modèles",
	tabMaintenance: "Maintenance",
	tabAbout: "À propos",

	languageName: "Langue",
	languageDesc: "Langue des réglages et des commandes.",
	langAuto: "Automatique (suivre Obsidian)",
	languageChangeHint:
		"Les noms des commandes sont mis à jour après le rechargement de l'extension.",

	autoNumberName: "Numérotation automatique globale",
	autoNumberDesc: "Numérote les titres en éditant ; sinon, utilisez « Renuméroter maintenant ».",

	debounceName: "Délai d'attente",
	debounceDesc: (min, max, def) =>
		`Délai après l'arrêt de la frappe avant de renuméroter (${min}–${max} ms, par défaut ${def}).`,
	resetTooltip: (def) => `Rétablir la valeur par défaut (${def} ms)`,

	updateBacklinksName: "Synchroniser les liens internes (rétroliens)",
	updateBacklinksDesc:
		"Quand le texte d'un titre change, met à jour les liens qui y mènent dans les autres notes.",

	headingLinkSuggestName: "Suggérer des liens vers les titres pendant la frappe",
	headingLinkSuggestDesc:
		"Suggère les titres du coffre correspondant à la saisie ; Tab insère un lien.",
	headingSuggestThisFile: "(ce fichier)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Coffre trop volumineux : l'index des titres est partiel (${indexed} indexés) ; les suggestions fonctionnent dans la zone indexée.`,
	vcTargetName: "Afficher les suggestions dans",
	vcTargetDesc:
		"La fenêtre de cette extension recouvre celle de VC ; avec VC, les titres rejoignent la sienne.",
	vcTargetPlugin: "Fenêtre de cette extension",
	vcTargetVc: "Fenêtre de Various Complements",

	sectionInterface: "Interface",
	sectionNumbering: "Numérotation automatique",
	sectionLinking: "Maintenance des liens",
	sectionSuggest: "Suggestions de liens vers les titres",
	sectionNoteEntry: "Menus dans la note",
	headingMenuName: "Menu contextuel des titres",
	headingMenuDesc:
		"Clic droit sur la flèche de repli à gauche d'un titre (édition ou lecture), ou menu contextuel de l'éditeur : ignorer, promouvoir/rétrograder, copier le lien, etc.",
	statusBarMenuName: "Étiquette de la note dans la barre d'état",
	statusBarMenuDesc:
		"Affiche l'état de numérotation de la note dans la barre d'état ; un clic permet de changer la numérotation auto, le modèle ou de renuméroter.",

	vcNotInstalledNotice:
		"Various Complements est introuvable (non installé ou désactivé) ; configuration automatique annulée. Installez-le et activez-le, ou utilisez la configuration manuelle.",
	vcDictionaryPathLabel: "Chemin du fichier de dictionnaire",
	vcCopyPathButton: "Copier le chemin",
	noticeVcPathCopied: "Chemin du fichier de dictionnaire copié.",
	vcManualConfirmTitle: "Activer l'intégration manuelle",
	vcManualConfirmBody:
		"Un dictionnaire de titres sera généré et tenu à jour dans le dossier de l'extension (aucun réglage de VC n'est modifié). Copiez le chemin dans « Custom dictionary paths » de VC et activez « Custom dictionary complement » ; il est conseillé de vider « Displayed text suffix », sinon les candidats s'affichent comme « titre => ... ».",
	vcManualConfirmButton: "Générer le dictionnaire",
	vcAutoConfirmTitle: "Activer l'intégration automatique",
	vcAutoConfirmBody:
		"Un dictionnaire de titres sera généré et VC configuré automatiquement (avec vérifications de sécurité ; si l'écriture n'est pas sûre, tout est annulé sans toucher à vos réglages de VC). Continuer ?",
	vcAutoConfirmPoints: [
		"Générer et tenir à jour le dictionnaire de titres (20 000 au maximum)",
		"Écrire dans VC : chemin du dictionnaire, « Custom dictionary complement » et seuil d'au moins 2 caractères",
		"Vider « Displayed text suffix » de VC (global : touche aussi vos autres dictionnaires)",
		"Porter « Max number of suggestions » de VC à 10 au moins (global ; seulement augmenté)",
		"Recharger les dictionnaires de VC après l'écriture (un échec est signalé à part)",
	],
	vcDescriptionOffHint:
		"VC masque la ligne d'origine des candidats (Description on suggestion : None).",
	vcOffConfirmTitle: "Arrêter l'intégration du dictionnaire",
	vcOffConfirmBody:
		"Le dictionnaire de titres ne sera plus mis à jour. Various Complements le charge encore ; le retirer aussi de VC ? Sinon, VC continue d'utiliser ce dictionnaire périmé (les titres renommés peuvent insérer des liens cassés).",
	vcOffKeepButton: "Conserver",
	vcOffRemoveButton: "Retirer de VC",
	vcStaleDictName: "VC charge encore l'ancien dictionnaire de titres",
	vcStaleDictDesc:
		"Il n'est plus mis à jour ; les titres renommés peuvent insérer des liens cassés.",
	vcStaleDictRemoveButton: "Retirer",
	noticeVcDictRemoved:
		"Le dictionnaire de titres de cette extension a été retiré de Various Complements.",
	noticeVcDictRemoveFailed:
		"Impossible de lire les réglages de Various Complements. Retirez ce chemin de dictionnaire manuellement dans les réglages de VC.",
	vcAutoConfirmButton: "Confirmer et configurer",
	vcAutoManualButton: "Configuration manuelle",
	noticeVcAutoWriteSuccess: "Intégration avec Various Complements configurée automatiquement.",
	noticeVcAutoWriteInvalidShape:
		"Le format de la configuration de VC ne correspond pas à l'attendu ; écriture automatique annulée (ses réglages sont intacts). Utilisez la configuration manuelle ou vérifiez la configuration de VC.",
	noticeVcAutoWriteNotInstalled:
		"Impossible de configurer VC automatiquement (non installé, désactivé ou fichier de données absent) ; installez-le et activez-le, ou utilisez la configuration manuelle.",
	noticeVcReloadFailed:
		"Le dictionnaire et les réglages de VC ont été écrits, mais le rechargement a échoué ; exécutez la commande « Reload custom dictionaries » de VC (ou redémarrez Obsidian).",
	noticeVcDictionaryTruncated: (total) =>
		`Le nombre total de titres (${total}) dépasse la limite du dictionnaire ; il a été tronqué et fonctionne dans la zone incluse.`,

	pathRulesHeading: "Règles de chemin",
	pathRulesDesc:
		"Associe des chemins à des modèles : les règles de dossier finissent par « / », la règle racine « / » est celle par défaut, et la plus spécifique l'emporte.",
	pathNoRootWarn:
		"⚠ Aucune règle de chemin racine (/). Avec la numérotation automatique globale activée, les fichiers sans règle ne sont pas numérotés.",
	addRootRule: "+ Ajouter la règle racine /",
	addRule: "Ajouter une règle",
	pathColPattern: "Chemin",
	pathColTemplate: "Modèle",
	pathEmpty:
		"(Aucune règle pour l'instant ; ajoutez une règle racine « / » pour couvrir tout le coffre.)",
	pathInputPlaceholder: "p. ex. Projets/ ou Notes/Travail profond.md ou /",
	templateMissingSuffix: (name) => `${name} (introuvable)`,
	clearInputTooltip: "Effacer ce chemin",
	deleteRuleTooltip: "Supprimer cette règle",
	dragHandleTooltip: "Glisser pour réordonner",
	pathDuplicateWarn: (otherRow) =>
		`Ce chemin est déjà utilisé par la règle n° ${otherRow} ; un chemin ne peut avoir qu'un modèle. Modifiez ou supprimez l'une des deux.`,
	pathSuggestEmptyFolder: "(Ce dossier est vide)",
	pathSuggestBackTooltip: "Remonter d'un niveau",
	pathSuggestDescendTooltip: "Voir le contenu",
	pathSuggestSelectHereTooltip: "Sélectionner ce niveau",
	pathTemplateNone: "Sans numérotation",
	batchRenumberTooltip: "Renumérotation par lot : renumérote tous les fichiers de cette règle",
	batchRenumberNoneTooltip: "Cette règle est « Sans numérotation » : rien à renuméroter",
	batchModalTitle: "Renumérotation par lot",
	batchModalBody: (pattern, count) =>
		`Renumérote ${count} fichier(s) Markdown correspondant à « ${pattern} », chacun avec son modèle effectif. ` +
		"Les fichiers « Sans numérotation », désactivés par le frontmatter ou portant une numérotation étrangère non reprise sont ignorés ; " +
		"les fichiers ouverts peuvent être annulés, les autres sont réécrits directement.",
	batchModalConfirm: "Renuméroter",
	batchModalCancel: "Annuler",
	pathColMode: "Numérotation",
	pathModeWrite: "Écrire dans le fichier",
	pathModeVirtual: "Affichage seul",
	pathModeTooltip:
		"Écrire dans le fichier : les numéros sont écrits dans la note et visibles dans les éditeurs externes, GitHub et Publish. Affichage seul : les numéros ne s'affichent que dans Obsidian, la note n'est jamais modifiée.",
	batchRenumberVirtualTooltip:
		"Cette règle est en « Affichage seul » : les numéros ne sont pas écrits, rien à renuméroter",
	modeModalTitle: "Changement de mode de numérotation",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} fichier(s) contiennent des numéros écrits par cette extension, qui cessera d'y écrire ` +
		`(${toVirtual} passent en affichage seul, ${toNone} sans numérotation).`,
	modeModalClearLabel:
		"Supprimer les numéros que cette extension a écrits dans ces fichiers (les numéros manuels sont conservés). Si la case est décochée, les numéros restent ; les fichiers en affichage seul les signaleront comme résidus.",
	modeModalEntering: (count) =>
		`${count} fichier(s) passeront de « Affichage seul » à « Écrire dans le fichier ».`,
	modeModalWriteLabel:
		"Écrire les numéros dans ces fichiers maintenant (sinon à la prochaine modification ; les fichiers ouverts sont mis à jour tout de suite)",
	modeModalConfirm: "Confirmer",
	noticeModeCleared: (count) => `Numéros de l'extension supprimés dans ${count} fichier(s)`,

	templatesHeading: "Modèles",
	templatesDesc:
		"Définit le format de numérotation et la liste d'exclusion par niveau de titre ; le modèle utilisé par chaque fichier est déterminé par les règles de chemin ci-dessus.",
	addTemplate: "Nouveau modèle",
	deleteBtn: "Supprimer",

	topLevelName: "Niveau de départ",
	bottomLevelName: "Niveau de fin",
	ancestorSelf: "Style propre (1.a.①)",
	ancestorArabic: "Tout en arabe (一 / 1.1)",

	colLevel: "Niveau",
	colPrefix: "Préfixe",
	colNumeral: "Numéral",
	colNumberSep: "Sép. de numéro",
	colSuffix: "Suffixe",
	colTitleSep: "Sép. de titre",
	colPreview: "Aperçu",
	inheritDepthAll: "Tous",
	previewHeadingWord: "Titre",

	skipFillFill: "Combler",
	skipFillDrop: "Omettre (supprimer le segment)",
	skipFillNone: "Ne pas numéroter (laisser tel quel)",

	matchExact: "Exacte",
	matchPartial: "Partielle",
	matchSubtree: "Sous-arbre",

	wlInputPlaceholder: "Saisissez un mot et appuyez sur Entrée pour l'ajouter…",
	wlFilterPlaceholder: "Filtrer les entrées…",
	wlSortAdded: "Par ordre d'ajout",
	wlSortAz: "A–Z",
	wlSortMatch: "Par type de correspondance",
	wlFilterNoMatch: "(Aucune entrée ne correspond au filtre)",
	wlEmpty:
		"Aucune entrée — saisissez un mot ci-dessus et appuyez sur Entrée ; les titres correspondants ne sont pas numérotés.",
	wlEditTitle: "Cliquer pour modifier",
	wlChipWarnTitle:
		"Le titre correspondant a des sous-titres ; ils restent numérotés et se rattacheraient au dernier ancêtre numéroté. Utilisez « Sous-arbre » pour exclure tout le bloc.",
	wlPreviewNoFile:
		"(Ouvrez un fichier Markdown avec des titres pour prévisualiser les correspondances de cette liste.)",
	wlPreviewNone: "Aucun titre du fichier actuel n'est exclu par cette liste.",
	wlPreviewSome: (count, titles) =>
		`Cette liste exclura ${count} titre(s) du fichier actuel : ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ D'après les règles de chemin, ce fichier utilise en réalité le modèle « ${appliedName} », pas celui que vous modifiez ; l'aperçu ci-dessous est hypothétique.`,
	wlPreviewNoTemplate:
		"⚠ Le fichier actuel ne correspond à aucune règle de chemin et ne sera pas numéroté automatiquement ; l'aperçu ci-dessous est hypothétique.",

	clearVaultName: "Effacer la numérotation de tout le coffre",
	clearVaultDesc:
		"Retire la numérotation de cette extension de toutes les notes et désactive l'automatique.",
	clearVaultBtn: "Effacer la numérotation du coffre…",
	freezeVaultName: "Figer la numérotation et céder la propriété",
	freezeVaultDesc:
		"Conserve les numéros, retire les marqueurs invisibles, arrête la numérotation.",
	freezeVaultBtn: "Figer la numérotation…",
	retiredBannerTitle: "L'extension a cédé la propriété de votre numérotation",
	retiredBannerBody:
		"Vos numéros restent du texte ordinaire et l'extension ne numérote plus automatiquement. Pour lui rendre la main : cliquez sur le bouton ci-dessous, puis lancez « Nettoyer la numérotation étrangère » sur les fichiers concernés ; sinon les numéros existants s'empileront avec un nouveau préfixe.",
	resumeBtn: "Reprendre la gestion de la numérotation",

	aboutLinkRepo: "Dépôt GitHub",
	aboutLinkIssues: "Signaler un problème",

	aboutCreditsHeading: "Remerciements",
	aboutCreditsIntro: "Le développement s'est inspiré des idées de ces extensions open source.",
	aboutCreditPathSuggest:
		"Suggestions de dossiers et fichiers et correspondance pour la saisie de chemin",
	aboutCreditBacklinks: "Référence d'origine pour la synchronisation des rétroliens",
	aboutCreditWordJoiner:
		"Référence d'origine pour marquer les numéros avec des caractères invisibles",

	defaultTemplateDisplay: "Par défaut",

	delModalTitle: (name) => `Supprimer le modèle « ${name} »`,
	delModalBody: (count) => `Ces ${count} règle(s) de chemin utilisent ce modèle :`,
	delModalEmptyPath: "(chemin vide)",
	delModalRedirect: "Après suppression, ces règles utiliseront",
	delModalDeleteRules: "Supprimer ces règles",
	cancel: "Annuler",
	confirmDelete: "Confirmer la suppression",

	clearVaultModalTitle: "Effacer la numérotation du coffre",
	clearVaultTurnOffAuto: "Désactiver aussi la numérotation automatique",
	clearVaultTurnOffAutoHint: "(pour que les numéros ne soient pas aussitôt rajoutés)",
	clearVaultModalBody:
		"Désactive d'abord la numérotation automatique globale, puis retire les préfixes de cette extension de tous les fichiers Markdown pour restaurer des titres nus (les liens sont aussi mis à jour si « Synchroniser les liens internes (rétroliens) » est activé). N'apparaît PAS dans l'historique d'annulation d'Obsidian : faites d'abord une sauvegarde. Continuer ?",
	confirmClearVault: "Confirmer l'effacement du coffre",

	freezeVaultModalTitle: "Figer la numérotation et céder la propriété",
	freezeVaultModalBody:
		"En confirmant : (1) vos numéros sont conservés tels quels, comme du texte ordinaire ; (2) les marqueurs invisibles (U+2060) sont retirés de tout le coffre, y compris dans les ancres de liens, donc [[note#titre]] reste résolu ; (3) l'extension arrête toute numérotation automatique (prime sur le frontmatter) ; (4) N'apparaît PAS dans l'historique d'annulation : faites d'abord une sauvegarde ; (5) pour reprendre la gestion plus tard, lancez d'abord « Nettoyer la numérotation étrangère », sinon un nouveau préfixe s'empilera. Continuer ?",
	confirmFreezeVault: "Confirmer figer et céder",

	foreignGuardModalTitle: "Numérotation possiblement étrangère à l'extension",
	foreignGuardModalBody: (count) =>
		`Ces ${count} titre(s) semblent numérotés, mais l'extension ne peut pas être sûre que vous les avez écrits vous-même (« Conception d'API », « Liste TODO », etc. peuvent être de faux positifs). Tous sont cochés par défaut ; en décocher un conserve son texte tel quel (l'extension ajoutera quand même sa numérotation) :`,
	foreignGuardItemToggle: (before) => `Nettoyer la numérotation étrangère de « ${before} »`,
	foreignGuardSearchPlaceholder: "Rechercher des titres…",
	foreignGuardSearchEmpty: "Aucun titre correspondant",

	cmdToggle: "Activer/désactiver la numérotation automatique globale",
	cmdRenumber: "Renuméroter la note actuelle",
	cmdClear: "Effacer la numérotation de la note actuelle",
	cmdClearForeign: "Nettoyer la numérotation étrangère des titres de la note actuelle",
	cmdClearStale: "Effacer la numérotation résiduelle de la note actuelle (affichage seul)",
	cmdCopyOutline: "Copier le plan numéroté",
	cmdCopySectionLink: "Copier le lien de la section actuelle",
	cmdCopySectionEmbed: "Copier le lien d'intégration de la section actuelle",
	cmdToggleHeadingSkip: "Ignorer / rétablir la numérotation du titre sous le curseur",
	cmdPromoteSection: "Promouvoir la section actuelle",
	cmdDemoteSection: "Rétrograder la section actuelle",
	cmdPromoteHeading: "Promouvoir le titre actuel (sans sous-titres)",
	cmdDemoteHeading: "Rétrograder le titre actuel (sans sous-titres)",
	cmdChooseNoteTemplate: "Choisir le modèle de la note actuelle…",
	cmdToggleNoteAuto: "Activer/désactiver la numérotation automatique de la note actuelle",
	menuToggleSkip: "Ignorer la numérotation de ce titre",
	menuToggleSkipTree: "Ignorer la numérotation de toute la section (sous-titres inclus)",
	menuCopySectionEmbed: "Copier l'intégration de la section",
	cmdToggleSectionSkip: "Ignorer / rétablir la numérotation de toute la section sous le curseur",
	menuCopySectionLink: "Copier le lien de la section",
	menuPromoteSection: "Promouvoir la section",
	menuDemoteSection: "Rétrograder la section",
	menuPromoteHeading: "Promouvoir ce titre seul (sans ses sous-titres)",
	menuDemoteHeading: "Rétrograder ce titre seul (sans ses sous-titres)",
	menuNoteSettings: "Réglages de numérotation de cette note…",
	menuBack: "Retour",
	handleHint: "Glissez pour déplacer la section · clic droit pour le menu",
	handleHintReading: "Clic droit pour le menu",
	noticeSectionShiftOutOfRange:
		"Un titre de cette section sortirait des niveaux 1–6 ; rien n'a été modifié",
	noticeNoteTemplateNoRule:
		"La numérotation n'est pas activée pour le chemin de cette note ; ajoutez d'abord une règle de chemin dans les réglages",
	noticeNoteTemplateSet: (name) => `Cette note utilise maintenant le modèle « ${name} »`,
	noticeNoteAutoOn: "Cette note sera toujours numérotée automatiquement",
	noticeNoteAutoOff: "Cette note ne sera pas numérotée automatiquement",
	noticeNoTemplates: "Aucun modèle disponible",
	chooseTemplatePlaceholder: "Choisissez un modèle pour cette note…",
	chooseTemplateFollowRule:
		"(Suivre la règle de chemin : effacer le réglage propre à cette note)",
	noticeNoteTemplateCleared: "Cette note suit de nouveau le modèle de sa règle de chemin",
	statusModeWrite: "Écriture",
	statusModeVirtual: "Affichage seul",
	statusNoNumbering: "Non numérotée",
	statusPausedByNote: "Suspendue pour la note",
	statusMenuRule: (path) => `Règle appliquée : ${path}`,
	statusMenuNoRule: "Aucune règle de chemin ne correspond",
	statusMenuAutoFollow: "Numérotation automatique : suivre la globale",
	statusMenuAutoOn: "Numérotation automatique : toujours pour cette note",
	statusMenuAutoOff: "Numérotation automatique : jamais pour cette note",
	statusMenuChangeTemplate: "Changer de modèle…",
	statusMenuRenumber: "Renuméroter maintenant",
	statusMenuCopyOutline: "Copier le plan numéroté",
	statusMenuClearStale: "Effacer la numérotation résiduelle",
	statusMenuCleanForeign: "Nettoyer la numérotation manuelle…",
	noticeStaleCleared:
		"Anciens numéros écrits par cette extension supprimés ; les numéros manuels sont conservés",
	noticeNoStaleNumbering: "Ce fichier ne contient aucun numéro écrit par cette extension",
	virtualStaleTooltip:
		"Ce fichier contient encore des numéros écrits auparavant par l'extension (les exports, Publish et les éditeurs externes les afficheront). Lancez « Effacer la numérotation résiduelle de l'extension dans ce fichier » pour les retirer",

	noticeEnabled: "Numérotation automatique globale activée",
	noticeDisabled: "Numérotation automatique globale désactivée",
	noticeNothingToClear: "Aucun préfixe de numérotation à effacer dans le fichier actuel",
	noticeCleared: "Numérotation effacée",
	noticeClearedAndPaused:
		"Numérotation effacée et numérotation automatique suspendue pour cette note (propriété obsidian-auto-headings: false) ; lancez « Renuméroter maintenant » pour la reprendre.",
	noticeRenumberedAndResumed: "Renumérotée ; numérotation automatique reprise pour cette note",
	noticeClearedVault: (count) =>
		`Numérotation du coffre effacée (${count} fichier(s) modifié(s))`,
	noticeFrozenVault: (count) =>
		`Numérotation figée et propriété cédée (${count} fichier(s) modifié(s)) ; les numéros restent en texte brut, la numérotation automatique est arrêtée`,
	noticeResumed:
		"Gestion de la numérotation reprise ; s'il reste des numéros figés dans vos fichiers, lancez d'abord « Nettoyer la numérotation étrangère »",
	noticeNoRule:
		"Le fichier actuel ne correspond à aucune règle de chemin ; impossible de le numéroter",
	noticeNoNumberingRule: "Le chemin de ce fichier est réglé sur « Sans numérotation »",
	noticeVirtualModeFile:
		"Ce fichier est en affichage seul : les numéros s'affichent dans Obsidian mais ne sont jamais écrits dans le fichier",
	noticeBatchNoMatch: "Cette règle ne correspond actuellement à aucun fichier Markdown",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Renumérotation par lot terminée : ${changed} mis à jour, ${unchanged} inchangés, ${skipped} ignorés`,
	noticeRenumbered: "Renumérotée",
	noticeNoChange: "Aucun changement nécessaire",
	noticeNoForeign: "Aucune numérotation étrangère à nettoyer dans le fichier actuel",
	noticeForeignCleared: "Numérotation étrangère des titres nettoyée",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Terminé : ${cleaned} nettoyés, ${kept} conservés tels quels avec numérotation ajoutée`
			: `Numérotation étrangère des titres nettoyée (${cleaned})`,
	noticeBacklinksUpdated: (count) => `${count} lien(s) interne(s) mis à jour`,
	noticeBacklinksIntro:
		"Auto Headings a mis à jour les liens internes d'autres fichiers qui pointent vers des titres de ce fichier (pour qu'ils ne cassent pas). Ces modifications ne figurent PAS dans l'historique d'annulation des fichiers modifiés ; désactivez « Synchroniser les liens internes » dans Réglages → Général. Affiché une seule fois.",
	noticeNoActiveFile: "Aucun fichier Markdown ouvert",
	noticeNoHeadings: "Le fichier actuel n'a aucun titre",
	noticeOutlineCopied: (count) => `Plan numéroté copié (${count} titre${count === 1 ? "" : "s"})`,
	noticeCopyFailed: "Échec de la copie dans le presse-papiers",
	noticeSectionLinkCopied: (label) => `Lien copié : ${label}`,
	noticeSectionEmbedCopied: (label) => `Lien d'intégration copié : ${label}`,
	noticeForeignNumberingGuardAction: "Examiner et nettoyer",
	noticeForeignGuardFileNotOpen:
		"Ce fichier n'est plus ouvert dans aucun onglet ; rouvrez-le pour le nettoyer",
	pathNoMatchHint: "Les notes qui ne correspondent à aucune règle ne sont pas numérotées.",
	activeRuleTooltip: "La note actuelle utilise cette règle",
	moreActionsTooltip: "Plus d'actions",
	templateBuiltinTag: "Intégré",
	templateCardUsage: (rules, whitelist) =>
		`Utilisé par ${rules} ${rules > 1 ? "règles" : "règle"} · ${whitelist} ${whitelist > 1 ? "entrées" : "entrée"} d'exclusion`,
	editBtn: "Modifier",
	templateActionsTooltip: "Actions du modèle",
	cardSampleTitles: ["Titre du document", "Aperçu", "Contexte", "Détails", "Point clé", "Notes"],
	editorKicker: "Modifier le modèle",
	renameTemplateTooltip: "Renommer le modèle",
	editorTabFormat: "Format",
	editorTabWhitelist: "Exclusions",
	rangeLabel: "Plage",
	rangeTo: "à",
	startIndexLabel: "Commencer à",
	startIndexHint: "Mettez 0 pour obtenir 0.1, 0.2…",
	moreRulesLabel: "Plus de règles",
	ancestorLabel: "Numéros parents",
	skipLabel: "Quand un niveau est sauté",
	placeholderLabel: "Marqueur",
	colParents: "Parents",
	inheritNone: "Aucun",
	inheritLevels: (n) => `${n} ${n > 1 ? "niveaux" : "niveau"}`,
	outOfRangeBefore: (top) => `Hors de la plage de numérotation (elle commence à H${top})`,
	outOfRangeAfter: (bottom) => `Hors de la plage de numérotation (elle s'arrête à H${bottom})`,
	previewTitle: "Aperçu",
	previewSample: "Exemple",
	previewCurrent: "Note actuelle",
	previewNoHeadings: "Cette note n'a pas encore de titres.",
	previewTagWhitelist: "Exclusion",
	previewTagSkip: "Ignoré",
	previewTagUnnumbered: "Non numéroté",
	previewSampleWords: [
		"Titre du document",
		"Aperçu",
		"Contexte",
		"Motivation",
		"Détails",
		"Notes",
		"Méthode",
		"Conclusion",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`Les changements s'appliquent immédiatement · touche ${notes} ${notes > 1 ? "notes" : "note"} sous ${rules} ${rules > 1 ? "règles" : "règle"}, dont ${writeNotes} écrites dans le fichier.`,
	footerUnused:
		"Les changements s'appliquent immédiatement · aucune règle de chemin n'utilise encore ce modèle.",
	footerWhitelist:
		"Les changements s'appliquent immédiatement · cliquez sur un mot pour le modifier.",
	doneBtn: "Terminé",
	editorQuickApply: "Application rapide",
	editorHistory: "Historique",
	quickRecentHeading: "Styles utilisés récemment",
	quickPresetHeading: "Schémas de numérotation courants",
	quickNoRecent: "Aucun style enregistré pour l'instant",
	presetDecimal: "Décimal · 1 / 1.1 / 1.1.1",
	presetChapter: "Chapitres · 第一章 / 第一节",
	presetOfficial: "Officiel · 一、/（一）/ 1.",
	presetLegal: "Juridique · 第一编 / 第一章 / 第一条",
	presetOutline: "Plan · I. / A. / 1.",
	historyTitle: (name) => `Historique des styles de « ${name} »`,
	historyEmpty:
		"Aucun historique — fermer l'éditeur après un changement de style y laisse un instantané.",
	historyRestore: "Restaurer",
	historyCurrent: "Identique à l'actuel",
	wlLegendIntro:
		"Les titres correspondants ne sont pas numérotés et ne consomment aucun numéro :",
	wlLegendExact: "exacte",
	wlLegendPartial: "contient le mot",
	wlLegendSubtree: "toute la section exclue, la numérotation reprend après",
	maintVaultHeading: "Tout le coffre",
	maintVaultMeta: "Impossible d'annuler — faites d'abord une sauvegarde",
	noticeStaleNotVirtual:
		"Cette note n'est pas en affichage seul : elle n'a donc pas de numérotation résiduelle.",
	confirmWordPrompt: (word) => `Saisissez « ${word} » pour confirmer`,
	clearVaultWord: "effacer",
	freezeVaultWord: "figer",
	aboutDescription:
		"Numérote les titres à partir de modèles (affichage seul ou écrits dans la note) et garde les liens synchronisés quand les titres changent.",
	foreignGuardSelectAll: "Tout sélectionner",
	foreignGuardSelected: (selected, total) => `${selected} sur ${total} sélectionnés`,
	foreignGuardUndoHint: "Les modifications de cette note peuvent être annulées avec Ctrl+Z",
	foreignGuardConfirmCount: (count) => `Nettoyer ${count}`,
	noticeForeignGuardCount: (count, virtual) =>
		`Cette note a ${count} titre(s) qui ressemblent à une numérotation manuelle ; cette fois, la numérotation n'a pas été ${virtual ? "affichée" : "appliquée"}.`,
};

export default fr;
