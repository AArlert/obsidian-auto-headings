// pt-BR 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** Português do Brasil; chaves ausentes recorrem ao inglês. */
const ptBR: Partial<Messages> = {
	tabGeneral: "Geral",
	tabTemplates: "Caminhos e modelos",
	tabMaintenance: "Manutenção",
	tabAbout: "Sobre",

	languageName: "Idioma",
	languageDesc: "Idioma das configurações e dos comandos.",
	langAuto: "Automático (seguir o Obsidian)",
	languageChangeHint: "Os nomes dos comandos são atualizados após recarregar o plugin.",

	autoNumberName: "Numeração automática global",
	autoNumberDesc: "Numera os cabeçalhos ao editar; se desligada, use «Renumerar agora».",

	debounceName: "Atraso de espera",
	debounceDesc: (min, max, def) =>
		`Tempo após parar de digitar até renumerar (${min}–${max} ms, padrão ${def}).`,
	resetTooltip: (def) => `Restaurar o padrão (${def} ms)`,

	updateBacklinksName: "Sincronizar links internos (backlinks)",
	updateBacklinksDesc:
		"Quando o texto de um cabeçalho muda, atualiza os links para ele em outras notas.",

	headingLinkSuggestName: "Sugerir links para cabeçalhos ao digitar",
	headingLinkSuggestDesc:
		"Sugere cabeçalhos do cofre que batem com o que você digita; Tab insere um link.",
	headingSuggestThisFile: "(este arquivo)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Cofre grande demais: o índice de cabeçalhos foi criado só em parte (${indexed} indexados); as sugestões funcionam dentro do que foi indexado.`,
	vcTargetName: "Mostrar sugestões em",
	vcTargetDesc:
		"A janela deste plugin cobre a do VC; com o VC, os cabeçalhos entram na janela dele.",
	vcTargetPlugin: "Janela deste plugin",
	vcTargetVc: "Janela do Various Complements",

	sectionInterface: "Interface",
	sectionNumbering: "Numeração automática",
	sectionLinking: "Manutenção de links",
	sectionSuggest: "Sugestões de links para cabeçalhos",

	vcNotInstalledNotice:
		"Various Complements não encontrado (não instalado ou desativado); configuração automática cancelada. Instale e ative-o, ou use a configuração manual.",
	vcDictionaryPathLabel: "Caminho do arquivo de dicionário",
	vcCopyPathButton: "Copiar caminho",
	noticeVcPathCopied: "Caminho do arquivo de dicionário copiado.",
	vcManualConfirmTitle: "Ativar a integração manual",
	vcManualConfirmBody:
		"Um dicionário de cabeçalhos será gerado e mantido na pasta do plugin (nenhuma configuração do VC é alterada). Copie o caminho para «Custom dictionary paths» do VC e ative «Custom dictionary complement»; recomenda-se esvaziar «Displayed text suffix», senão os candidatos aparecem como «cabeçalho => ...».",
	vcManualConfirmButton: "Gerar dicionário",
	vcAutoConfirmTitle: "Ativar a integração automática",
	vcAutoConfirmBody:
		"Um dicionário de cabeçalhos será gerado e o VC configurado automaticamente (com verificações de segurança; se não for possível gravar com segurança, cancela sem tocar nas suas configurações do VC). Continuar?",
	vcAutoConfirmPoints: [
		"Gerar e manter o dicionário de cabeçalhos (no máximo 20.000)",
		"Gravar no VC: caminho do dicionário, «Custom dictionary complement» e limite de ativação de pelo menos 2 caracteres",
		"Esvaziar «Displayed text suffix» do VC (global: afeta também seus outros dicionários)",
		"Elevar «Max number of suggestions» do VC para pelo menos 10 (global; só aumenta)",
		"Recarregar os dicionários do VC após gravar (uma falha é avisada à parte)",
	],
	vcDescriptionOffHint:
		"O VC oculta a linha de origem do candidato (Description on suggestion: None).",
	vcOffConfirmTitle: "Parar a integração do dicionário",
	vcOffConfirmBody:
		"O dicionário de cabeçalhos deixará de ser atualizado. O Various Complements ainda o carrega; removê-lo também do VC? Se mantido, o VC continua usando este dicionário desatualizado (cabeçalhos renomeados podem inserir links quebrados).",
	vcOffKeepButton: "Manter",
	vcOffRemoveButton: "Remover do VC",
	vcStaleDictName: "O VC ainda carrega o dicionário antigo de cabeçalhos",
	vcStaleDictDesc:
		"Ele não é mais atualizado; cabeçalhos renomeados podem inserir links quebrados.",
	vcStaleDictRemoveButton: "Remover",
	noticeVcDictRemoved:
		"O dicionário de cabeçalhos deste plugin foi removido do Various Complements.",
	noticeVcDictRemoveFailed:
		"Não foi possível ler as configurações do Various Complements. Remova este caminho de dicionário manualmente nas configurações do VC.",
	vcAutoConfirmButton: "Confirmar e configurar",
	vcAutoManualButton: "Configuração manual",
	noticeVcAutoWriteSuccess: "Integração com o Various Complements configurada automaticamente.",
	noticeVcAutoWriteInvalidShape:
		"O formato da configuração do VC não é o esperado; gravação automática cancelada (as configurações dele não foram alteradas). Use a configuração manual ou verifique a configuração do VC.",
	noticeVcAutoWriteNotInstalled:
		"Não foi possível configurar o VC automaticamente (não instalado, desativado ou arquivo de dados ausente); instale e ative-o, ou use a configuração manual.",
	noticeVcReloadFailed:
		"O dicionário e as configurações do VC foram gravados, mas o recarregamento falhou; execute o comando «Reload custom dictionaries» do VC (ou reinicie o Obsidian).",
	noticeVcDictionaryTruncated: (total) =>
		`O total de cabeçalhos (${total}) excede o limite do dicionário; ele foi truncado e funciona dentro do que foi incluído.`,

	pathRulesHeading: "Regras de caminho",
	pathRulesDesc:
		"Associa caminhos a modelos: regras de pasta terminam em «/», a regra raiz «/» é o padrão global e vence a regra mais específica.",
	pathNoRootWarn:
		"⚠ Não há regra de caminho raiz (/). Com a numeração automática global ligada, arquivos sem regra correspondente não são numerados.",
	addRootRule: "+ Adicionar regra raiz /",
	addRule: "Adicionar regra",
	pathColPattern: "Caminho",
	pathColTemplate: "Modelo",
	pathEmpty: "(Ainda não há regras; adicione uma regra raiz «/» para cobrir todo o cofre.)",
	pathInputPlaceholder: "ex.: Projetos/ ou Notas/Trabalho focado.md ou /",
	templateMissingSuffix: (name) => `${name} (inexistente)`,
	clearInputTooltip: "Limpar este caminho",
	deleteRuleTooltip: "Excluir esta regra",
	dragHandleTooltip: "Arraste para reordenar",
	pathDuplicateWarn: (otherRow) =>
		`Este caminho já é usado pela regra n.º ${otherRow}; um caminho só pode ter um modelo. Edite ou exclua uma delas.`,
	pathSuggestEmptyFolder: "(Esta pasta está vazia)",
	pathSuggestBackTooltip: "Subir um nível",
	pathSuggestDescendTooltip: "Ver conteúdo",
	pathSuggestSelectHereTooltip: "Selecionar este nível",
	pathTemplateNone: "Sem numeração",
	batchRenumberTooltip: "Renumeração em lote: renumera todos os arquivos desta regra",
	batchRenumberNoneTooltip: "Esta regra está como «Sem numeração»: nada para renumerar",
	batchModalTitle: "Renumeração em lote",
	batchModalBody: (pattern, count) =>
		`Renumera ${count} arquivo(s) Markdown que correspondem a «${pattern}», cada um com seu modelo em vigor. ` +
		"Arquivos «Sem numeração», desativados por frontmatter ou com numeração alheia não assumida são ignorados; " +
		"arquivos abertos aceitam desfazer, os fechados são reescritos diretamente.",
	batchModalConfirm: "Renumerar",
	batchModalCancel: "Cancelar",
	pathColMode: "Numeração",
	pathModeWrite: "Gravar no arquivo",
	pathModeVirtual: "Somente exibir",
	pathModeTooltip:
		"Gravar no arquivo: os números são gravados na nota e aparecem em editores externos, no GitHub e no Publish. Somente exibir: os números aparecem apenas no Obsidian e a nota nunca é alterada.",
	batchRenumberVirtualTooltip:
		"Esta regra é «Somente exibir»: os números não são gravados, nada para renumerar",
	modeModalTitle: "Mudança do modo de numeração",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} arquivo(s) contêm números gravados por este plugin, que deixará de gravar neles ` +
		`(${toVirtual} passam a somente exibir, ${toNone} a sem numeração).`,
	modeModalClearLabel:
		"Remover os números que este plugin gravou nesses arquivos (números manuais não são tocados). Se desmarcado, os números permanecem; arquivos em somente exibir os apontarão como resíduos.",
	modeModalEntering: (count) =>
		`${count} arquivo(s) passarão de «Somente exibir» para «Gravar no arquivo».`,
	modeModalWriteLabel:
		"Gravar os números nesses arquivos agora (senão, na próxima edição; arquivos abertos são atualizados na hora)",
	modeModalConfirm: "Confirmar",
	noticeModeCleared: (count) => `Números do plugin removidos de ${count} arquivo(s)`,

	templatesHeading: "Modelos",
	templatesDesc:
		"Define o formato de numeração e a lista de exceções por nível de cabeçalho; qual arquivo usa qual modelo é decidido pelas regras de caminho acima.",
	addTemplate: "Novo modelo",
	deleteBtn: "Excluir",

	topLevelName: "Nível inicial",
	bottomLevelName: "Nível final",
	ancestorSelf: "Estilo próprio (1.a.①)",
	ancestorArabic: "Tudo arábico (一 / 1.1)",

	colLevel: "Nível",
	colPrefix: "Prefixo",
	colNumeral: "Numeral",
	colNumberSep: "Sep. do número",
	colSuffix: "Sufixo",
	colTitleSep: "Sep. do título",
	colPreview: "Prévia",
	inheritDepthAll: "Todos",
	previewHeadingWord: "Cabeçalho",

	skipFillFill: "Preencher",
	skipFillDrop: "Omitir (suprimir o segmento)",
	skipFillNone: "Não numerar (deixar como está)",

	matchExact: "Exata",
	matchPartial: "Parcial",
	matchSubtree: "Subárvore",

	wlInputPlaceholder: "Digite uma palavra e pressione Enter para adicionar…",
	wlFilterPlaceholder: "Filtrar entradas…",
	wlSortAdded: "Por ordem de adição",
	wlSortAz: "A–Z",
	wlSortMatch: "Por tipo de correspondência",
	wlFilterNoMatch: "(Nenhuma entrada corresponde ao filtro)",
	wlEmpty:
		"Ainda não há entradas — digite uma palavra acima e pressione Enter; cabeçalhos correspondentes não são numerados.",
	wlEditTitle: "Clique para editar",
	wlChipWarnTitle:
		"O cabeçalho correspondente tem subcabeçalhos; eles continuam numerados e se prenderiam ao ancestral numerado anterior. Use «Subárvore» para excluir o bloco inteiro.",
	wlPreviewNoFile:
		"(Abra um arquivo Markdown com cabeçalhos para ver as correspondências desta lista.)",
	wlPreviewNone: "Nenhum cabeçalho do arquivo atual é excluído por esta lista.",
	wlPreviewSome: (count, titles) =>
		`Esta lista excluirá ${count} cabeçalho(s) do arquivo atual: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ Pelas regras de caminho, este arquivo na verdade usa o modelo «${appliedName}», não o que você está editando; a prévia abaixo é hipotética.`,
	wlPreviewNoTemplate:
		"⚠ O arquivo atual não corresponde a nenhuma regra de caminho e não será numerado automaticamente; a prévia abaixo é hipotética.",

	clearVaultName: "Limpar a numeração de todo o cofre",
	clearVaultDesc: "Remove a numeração deste plugin de todas as notas e desliga a automática.",
	clearVaultBtn: "Limpar numeração do cofre…",
	freezeVaultName: "Fixar a numeração e devolver a propriedade",
	freezeVaultDesc: "Mantém os números, remove os marcadores invisíveis e para a numeração.",
	freezeVaultBtn: "Fixar numeração…",
	retiredBannerTitle: "O plugin devolveu a propriedade da sua numeração",
	retiredBannerBody:
		"Seus números permanecem como texto comum e o plugin não numera automaticamente. Para devolver o controle: clique no botão abaixo e execute «Limpar numeração alheia» nos arquivos afetados; senão, os números existentes se acumulam com um prefixo novo.",
	resumeBtn: "Retomar o gerenciamento da numeração",

	aboutLinkRepo: "Repositório no GitHub",
	aboutLinkIssues: "Relatar um problema",

	aboutCreditsHeading: "Créditos",
	aboutCreditsIntro: "O desenvolvimento se inspirou em ideias destes plugins de código aberto.",
	aboutCreditPathSuggest:
		"Sugestões de pastas e arquivos e correspondência na entrada de caminho",
	aboutCreditBacklinks: "Referência original para a sincronização de backlinks",
	aboutCreditWordJoiner: "Referência original para marcar números com caracteres invisíveis",

	defaultTemplateDisplay: "Padrão",

	delModalTitle: (name) => `Excluir o modelo «${name}»`,
	delModalBody: (count) => `Estas ${count} regra(s) de caminho usam este modelo:`,
	delModalEmptyPath: "(caminho vazio)",
	delModalRedirect: "Após excluir, estas regras usarão",
	delModalDeleteRules: "Excluir estas regras",
	cancel: "Cancelar",
	confirmDelete: "Confirmar exclusão",

	clearVaultModalTitle: "Limpar a numeração do cofre",
	clearVaultTurnOffAuto: "Desligar também a numeração automática",
	clearVaultTurnOffAutoHint: "(para que os números não sejam recolocados logo em seguida)",
	clearVaultModalBody:
		"Primeiro DESLIGA a numeração automática global e depois remove os prefixos deste plugin de todos os arquivos Markdown, restaurando os cabeçalhos simples (os links também são atualizados se «Sincronizar links internos (backlinks)» estiver ligado). NÃO fica no histórico de desfazer do Obsidian — faça um backup antes. Continuar?",
	confirmClearVault: "Confirmar limpeza do cofre",

	freezeVaultModalTitle: "Fixar a numeração e devolver a propriedade",
	freezeVaultModalBody:
		"Ao confirmar: (1) seus números são mantidos como estão, virando texto comum; (2) os marcadores invisíveis (U+2060) são removidos de todo o cofre, inclusive dentro de âncoras de links, então [[nota#cabeçalho]] continua funcionando; (3) o plugin para toda numeração automática (prevalece sobre o frontmatter); (4) NÃO fica no histórico de desfazer — faça um backup antes; (5) para reassumir depois, execute antes «Limpar numeração alheia», senão um prefixo novo será acumulado. Continuar?",
	confirmFreezeVault: "Confirmar fixação e devolução",

	foreignGuardModalTitle: "Possível numeração alheia ao plugin",
	foreignGuardModalBody: (count) =>
		`Estes ${count} cabeçalho(s) parecem numerados, mas o plugin não tem certeza de que você os escreveu («Design de API», «Lista TODO» etc. podem ser falsos positivos). Todos vêm marcados; desmarcar mantém o texto como está (o plugin ainda adicionará a própria numeração):`,
	foreignGuardItemToggle: (before) => `Limpar a numeração alheia de «${before}»`,
	foreignGuardSearchPlaceholder: "Buscar cabeçalhos…",
	foreignGuardSearchEmpty: "Nenhum cabeçalho correspondente",

	cmdToggle: "Alternar numeração automática global",
	cmdRenumber: "Renumerar a nota atual",
	cmdClear: "Limpar a numeração da nota atual",
	cmdClearForeign: "Limpar numeração alheia de cabeçalhos na nota atual",
	cmdClearStale: "Limpar numeração residual da nota atual (modo somente exibir)",
	cmdCopyOutline: "Copiar estrutura numerada",
	cmdCopySectionLink: "Copiar link da seção atual",
	cmdCopySectionEmbed: "Copiar link de incorporação da seção atual",
	cmdToggleHeadingSkip: "Pular / restaurar a numeração do cabeçalho sob o cursor",
	cmdPromoteSection: "Promover a seção atual",
	cmdDemoteSection: "Rebaixar a seção atual",
	cmdChooseNoteTemplate: "Escolher modelo para a nota atual…",
	cmdToggleNoteAuto: "Alternar numeração automática da nota atual",
	menuToggleSkip: "Pular a numeração deste cabeçalho",
	menuToggleSkipTree: "Pular a numeração da seção inteira (com subcabeçalhos)",
	menuCopySectionEmbed: "Copiar incorporação da seção",
	cmdToggleSectionSkip: "Pular / restaurar a numeração da seção inteira sob o cursor",
	menuCopySectionLink: "Copiar link da seção",
	menuPromoteSection: "Promover seção",
	menuDemoteSection: "Rebaixar seção",
	menuNoteSettings: "Configurações de numeração desta nota…",
	menuBack: "Voltar",
	handleHint: "Arraste para mover a seção · clique direito para o menu",
	handleHintReading: "Clique direito para o menu",
	noticeSectionShiftOutOfRange:
		"Um cabeçalho desta seção sairia dos níveis 1–6; nada foi alterado",
	noticeNoteTemplateNoRule:
		"O caminho desta nota não tem numeração ativada; adicione antes uma regra de caminho nas configurações",
	noticeNoteTemplateSet: (name) => `Esta nota agora usa o modelo «${name}»`,
	noticeNoteAutoOn: "Esta nota será sempre numerada automaticamente",
	noticeNoteAutoOff: "Esta nota não será numerada automaticamente",
	noticeNoTemplates: "Nenhum modelo disponível",
	chooseTemplatePlaceholder: "Escolha um modelo para esta nota…",
	chooseTemplateFollowRule: "(Seguir a regra de caminho — limpar a escolha própria desta nota)",
	noticeNoteTemplateCleared: "Esta nota voltou a usar o modelo da sua regra de caminho",
	statusModeWrite: "Gravar",
	statusModeVirtual: "Somente exibir",
	statusNoNumbering: "Sem numeração",
	statusPausedByNote: "Pausada na nota",
	statusMenuRule: (path) => `Regra correspondente: ${path}`,
	statusMenuNoRule: "Nenhuma regra de caminho corresponde",
	statusMenuAutoFollow: "Numeração automática: seguir a global",
	statusMenuAutoOn: "Numeração automática: sempre nesta nota",
	statusMenuAutoOff: "Numeração automática: nunca nesta nota",
	statusMenuChangeTemplate: "Trocar de modelo…",
	statusMenuRenumber: "Renumerar agora",
	statusMenuCopyOutline: "Copiar estrutura numerada",
	statusMenuClearStale: "Limpar numeração residual",
	statusMenuCleanForeign: "Limpar numeração manual…",
	noticeStaleCleared:
		"Números antigos gravados por este plugin removidos; números manuais não foram tocados",
	noticeNoStaleNumbering: "Este arquivo não tem números gravados por este plugin",
	virtualStaleTooltip:
		"Este arquivo ainda contém números que o plugin gravou antes (exportações, Publish e editores externos os mostrarão). Execute «Limpar numeração residual do plugin neste arquivo» para removê-los",

	noticeEnabled: "Numeração automática global ativada",
	noticeDisabled: "Numeração automática global desativada",
	noticeNothingToClear: "Não há prefixo de numeração a limpar no arquivo atual",
	noticeCleared: "Numeração limpa",
	noticeClearedAndPaused:
		"Numeração limpa e numeração automática pausada nesta nota (propriedade obsidian-auto-headings: false); execute «Renumerar agora» para retomar.",
	noticeRenumberedAndResumed: "Renumerada; numeração automática desta nota retomada",
	noticeClearedVault: (count) => `Numeração do cofre limpa (${count} arquivo(s) alterado(s))`,
	noticeFrozenVault: (count) =>
		`Numeração fixada e propriedade devolvida (${count} arquivo(s) alterado(s)); os números ficam como texto comum e a numeração automática é desligada`,
	noticeResumed:
		"Gerenciamento da numeração retomado; se ainda houver números fixados nos seus arquivos, execute antes «Limpar numeração alheia»",
	noticeNoRule:
		"O arquivo atual não corresponde a nenhuma regra de caminho; não é possível numerá-lo",
	noticeNoNumberingRule: "O caminho deste arquivo está como «Sem numeração»",
	noticeVirtualModeFile:
		"Este arquivo está em modo somente exibir: os números aparecem no Obsidian, mas nunca são gravados no arquivo",
	noticeBatchNoMatch: "Esta regra não corresponde atualmente a nenhum arquivo Markdown",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Renumeração em lote concluída: ${changed} atualizados, ${unchanged} sem alteração, ${skipped} ignorados`,
	noticeRenumbered: "Renumerada",
	noticeNoChange: "Nenhuma alteração necessária",
	noticeNoForeign: "Não há numeração alheia a limpar no arquivo atual",
	noticeForeignCleared: "Numeração alheia de cabeçalhos limpa",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Concluído: ${cleaned} limpos, ${kept} mantidos como estão com numeração adicionada`
			: `Numeração alheia de cabeçalhos limpa (${cleaned})`,
	noticeBacklinksUpdated: (count) => `${count} link(s) interno(s) atualizado(s)`,
	noticeBacklinksIntro:
		"O Auto Headings atualizou links internos de outros arquivos que apontam para cabeçalhos deste arquivo (para não quebrarem). Essas alterações NÃO ficam no histórico de desfazer dos arquivos modificados; desligue «Sincronizar links internos» em Configurações → Geral. Exibido uma única vez.",
	noticeNoActiveFile: "Nenhum arquivo Markdown aberto",
	noticeNoHeadings: "O arquivo atual não tem cabeçalhos",
	noticeOutlineCopied: (count) =>
		`Estrutura numerada copiada (${count} cabeçalho${count === 1 ? "" : "s"})`,
	noticeCopyFailed: "Falha ao copiar para a área de transferência",
	noticeSectionLinkCopied: (label) => `Link copiado: ${label}`,
	noticeSectionEmbedCopied: (label) => `Link de incorporação copiado: ${label}`,
	noticeForeignNumberingGuardAction: "Revisar e limpar",
	noticeForeignGuardFileNotOpen:
		"Este arquivo não está mais aberto em nenhuma aba; reabra-o para limpar",
	pathNoMatchHint: "Notas que não correspondem a nenhuma regra não são numeradas.",
	activeRuleTooltip: "A nota atual usa esta regra",
	moreActionsTooltip: "Mais ações",
	templateBuiltinTag: "Integrado",
	templateCardUsage: (rules, whitelist) =>
		`Usado por ${rules} ${rules === 1 ? "regra" : "regras"} · ${whitelist} ${whitelist === 1 ? "exceção" : "exceções"}`,
	editBtn: "Editar",
	templateActionsTooltip: "Ações do modelo",
	cardSampleTitles: [
		"Título do documento",
		"Visão geral",
		"Contexto",
		"Detalhes",
		"Ponto-chave",
		"Observações",
	],
	editorKicker: "Editar modelo",
	renameTemplateTooltip: "Renomear modelo",
	editorTabFormat: "Formato",
	editorTabWhitelist: "Exceções",
	rangeLabel: "Intervalo",
	rangeTo: "a",
	startIndexLabel: "Começar em",
	startIndexHint: "Use 0 para obter 0.1, 0.2…",
	moreRulesLabel: "Mais regras",
	ancestorLabel: "Números superiores",
	skipLabel: "Quando um nível é pulado",
	placeholderLabel: "Marcador",
	colParents: "Superiores",
	inheritNone: "Nenhum",
	inheritLevels: (n) => `${n} ${n === 1 ? "nível" : "níveis"}`,
	outOfRangeBefore: (top) => `Fora do intervalo de numeração (começa em H${top})`,
	outOfRangeAfter: (bottom) => `Fora do intervalo de numeração (termina em H${bottom})`,
	previewTitle: "Prévia",
	previewSample: "Exemplo",
	previewCurrent: "Nota atual",
	previewNoHeadings: "Esta nota ainda não tem cabeçalhos.",
	previewTagWhitelist: "Exceção",
	previewTagSkip: "Pulado",
	previewTagUnnumbered: "Sem número",
	previewSampleWords: [
		"Título do documento",
		"Visão geral",
		"Contexto",
		"Motivação",
		"Detalhes",
		"Observações",
		"Método",
		"Conclusão",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`As alterações valem na hora · afeta ${notes} ${notes === 1 ? "nota" : "notas"} em ${rules} ${rules === 1 ? "regra" : "regras"}, ${writeNotes} gravadas no arquivo.`,
	footerUnused: "As alterações valem na hora · nenhuma regra de caminho usa este modelo ainda.",
	footerWhitelist: "As alterações valem na hora · clique em uma palavra para editá-la.",
	doneBtn: "Concluir",
	editorQuickApply: "Aplicação rápida",
	editorHistory: "Histórico",
	quickRecentHeading: "Estilos usados recentemente",
	quickPresetHeading: "Esquemas de numeração comuns",
	quickNoRecent: "Ainda não há estilos salvos",
	presetDecimal: "Decimal · 1 / 1.1 / 1.1.1",
	presetChapter: "Capítulos · 第一章 / 第一节",
	presetOfficial: "Oficial · 一、/（一）/ 1.",
	presetLegal: "Jurídico · 第一编 / 第一章 / 第一条",
	presetOutline: "Estrutura · I. / A. / 1.",
	historyTitle: (name) => `Histórico de estilos de «${name}»`,
	historyEmpty:
		"Ainda não há histórico — fechar o editor após mudar um estilo deixa aqui um instantâneo.",
	historyRestore: "Restaurar",
	historyCurrent: "Igual ao atual",
	wlLegendIntro: "Cabeçalhos correspondentes não são numerados e não consomem número:",
	wlLegendExact: "exata",
	wlLegendPartial: "contém a palavra",
	wlLegendSubtree: "seção inteira excluída; a numeração continua depois",
	maintVaultHeading: "Todo o cofre",
	maintVaultMeta: "Não pode ser desfeito — faça um backup antes",
	noticeStaleNotVirtual:
		"Esta nota não está em modo somente exibir, então não tem numeração residual.",
	confirmWordPrompt: (word) => `Digite «${word}» para confirmar`,
	clearVaultWord: "limpar",
	freezeVaultWord: "fixar",
	aboutDescription:
		"Numera cabeçalhos a partir de modelos — só exibindo ou gravando na nota — e mantém os links sincronizados quando os cabeçalhos mudam.",
	foreignGuardSelectAll: "Selecionar tudo",
	foreignGuardSelected: (selected, total) => `${selected} de ${total} selecionados`,
	foreignGuardUndoHint: "As alterações nesta nota podem ser desfeitas com Ctrl+Z",
	foreignGuardConfirmCount: (count) => `Limpar ${count}`,
	noticeForeignGuardCount: (count, virtual) =>
		`Esta nota tem ${count} cabeçalho(s) que parecem numeração manual; desta vez a numeração não foi ${virtual ? "exibida" : "aplicada"}.`,
};

export default ptBR;
