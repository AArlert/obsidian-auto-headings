// ja 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** 日本語文案；缺的键回落英文。 */
const ja: Partial<Messages> = {
	tabGeneral: "全般",
	tabTemplates: "パステンプレート",
	tabMaintenance: "番号メンテナンス",
	tabAbout: "このプラグインについて",

	languageName: "言語",
	languageDesc: "設定画面とコマンドの表示言語。",
	langAuto: "自動（Obsidian に従う）",
	languageChangeHint: "コマンド名はプラグインを再読み込みすると新しい言語になります。",

	autoNumberName: "グローバル自動採番",
	autoNumberDesc:
		"編集中に見出しへ自動で番号を振ります。オフでも「今すぐ再採番」で手動実行できます。",

	debounceName: "デバウンス遅延",
	debounceDesc: (min, max, def) =>
		`入力が止まってから採番するまでの時間（${min}–${max} ms、既定 ${def}）。`,
	resetTooltip: (def) => `既定値 ${def} ms に戻す`,

	updateBacklinksName: "内部リンクを同期（バックリンク）",
	updateBacklinksDesc: "見出しの文字が変わると、他のノートからのリンクも自動で更新します。",

	headingLinkSuggestName: "入力中に見出しリンクを候補表示",
	headingLinkSuggestDesc:
		"Vault の見出しと同じ文字を入力すると候補を表示し、Tab でリンクを挿入。",
	headingSuggestThisFile: "（このファイル）",
	noticeHeadingIndexTruncated: (indexed) =>
		`Vault が大きすぎるため見出しインデックスを完全には作成できませんでした（${indexed} 件）。候補機能は作成済みの範囲で使えます。`,
	vcTargetName: "候補の表示先",
	vcTargetDesc: "このプラグインの枠は VC の枠を覆います。VC を選ぶと見出しも VC の枠に出ます。",
	vcTargetPlugin: "このプラグインの候補枠",
	vcTargetVc: "Various Complements の候補枠",

	sectionInterface: "表示",
	sectionNumbering: "自動採番",
	sectionLinking: "リンクの保守",
	sectionSuggest: "見出しリンク候補",
	sectionNoteEntry: "メニュー",
	headingMenuName: "見出しメニュー",
	headingMenuDesc: "見出し左の矢印を右クリック：レベル変更、採番スキップ、リンクコピー。",
	statusBarMenuName: "ステータスバーメニュー",
	statusBarMenuDesc: "ステータスバーに採番状態を表示。クリックで自動採番やテンプレートを切替。",

	vcNotInstalledNotice:
		"Various Complements が見つかりません（未インストールまたは無効）。自動設定を中止しました。先にインストールして有効化するか、「手動設定」を使ってください。",
	vcDictionaryPathLabel: "辞書ファイルのパス",
	vcCopyPathButton: "パスをコピー",
	noticeVcPathCopied: "辞書ファイルのパスをコピーしました。",
	vcManualConfirmTitle: "手動連携を有効にする",
	vcManualConfirmBody:
		"プラグインフォルダに見出し辞書ファイルを作成・更新します。VC の設定は一切変更しません。パスをコピーして VC の「Custom dictionary paths」に貼り付け、「Custom dictionary complement」を有効にしてください。「Displayed text suffix」は空にするのがおすすめです（そうしないと候補が「見出し => ...」と表示されます）。",
	vcManualConfirmButton: "辞書ファイルを作成",
	vcAutoConfirmTitle: "自動連携を有効にする",
	vcAutoConfirmBody:
		"見出し辞書を作成し、VC を自動設定します（常に安全確認を行い、書き込めなければ中止して既存の設定は変更しません）。続行しますか？",
	vcAutoConfirmPoints: [
		"見出し辞書を作成・更新（上限 2 万件、超過分は切り捨て）",
		"VC の設定に書き込み：辞書パス、「カスタム辞書補完」をオン、トリガーを 2 文字以上に",
		"VC の「補完候補の表示サフィックス」を空に（全体設定のため他の辞書の候補にも影響）",
		"VC の「候補ボックスの最大表示数」を 10 以上に引き上げ（全体設定、引き上げのみ）",
		"書き込み後に VC の辞書を自動で再読み込み（失敗時は別途通知）",
	],
	vcDescriptionOffHint: "VC で候補の出典行が無効です（Description on suggestion が None）。",
	vcOffConfirmTitle: "辞書連携を停止",
	vcOffConfirmBody:
		"以後、見出し辞書は更新されません。Various Complements にはこの辞書が登録されたままです。一緒に削除しますか？削除しない場合、VC は更新されない古い辞書を使い続けます（見出しの改名後に無効なリンクが挿入されることがあります）。",
	vcOffKeepButton: "残す",
	vcOffRemoveButton: "VC から削除",
	vcStaleDictName: "VC が古い見出し辞書を読み込み中",
	vcStaleDictDesc: "この辞書は更新されません。見出しの改名後に無効なリンクが入ることがあります。",
	vcStaleDictRemoveButton: "削除",
	noticeVcDictRemoved: "Various Complements からこのプラグインの見出し辞書を削除しました。",
	noticeVcDictRemoveFailed:
		"Various Complements の設定を読み取れませんでした。VC の設定でこの辞書パスを手動で削除してください。",
	vcAutoConfirmButton: "確認して自動設定",
	vcAutoManualButton: "手動設定",
	noticeVcAutoWriteSuccess: "Various Complements との連携を自動設定しました。",
	noticeVcAutoWriteInvalidShape:
		"VC の設定形式が想定と異なるため、自動書き込みを中止しました（設定は未変更）。「手動設定」を使うか、設定ファイルを確認してください。",
	noticeVcAutoWriteNotInstalled:
		"VC を自動設定できませんでした（未インストール・無効・データファイルなし）。先にインストールして有効化するか、「手動設定」を使ってください。",
	noticeVcReloadFailed:
		"辞書と VC の設定は書き込みましたが、辞書の自動再読み込みに失敗しました。VC の「Reload custom dictionaries」コマンドを手動で実行するか、Obsidian を再起動してください。",
	noticeVcDictionaryTruncated: (total) =>
		`見出しの総数（${total}）が辞書の上限を超えたため切り捨てました。候補機能は収録済みの範囲で使えます。`,

	pathRulesHeading: "パスルール",
	pathRulesDesc:
		"パスをテンプレートに対応づけます。フォルダルールは「/」で終わり、「/」のルートルールが全体の既定です。最も具体的なルールが優先されます。",
	pathNoRootWarn:
		"⚠ ルートパスルール（/）がありません。「グローバル自動採番」がオンでも、どのルールにも一致しないファイルは採番されません。",
	addRootRule: "+ / ルートルールを追加",
	addRule: "ルールを追加",
	pathColPattern: "パス",
	pathColTemplate: "テンプレート",
	pathEmpty: "（ルールがありません。「/」ルートルールを追加すると Vault 全体に適用されます）",
	pathInputPlaceholder: "例：Projects/ または 読書メモ/深い仕事.md または /",
	templateMissingSuffix: (name) => `${name}（無効）`,
	clearInputTooltip: "このパスを消去",
	deleteRuleTooltip: "このルールを削除",
	dragHandleTooltip: "ドラッグで並べ替え",
	pathDuplicateWarn: (otherRow) =>
		`このパスは ${otherRow} 番目のルールで使われています。1 つのパスに関連づけられるテンプレートは 1 つだけです。どちらかを変更または削除してください。`,
	pathSuggestEmptyFolder: "（このフォルダは空です）",
	pathSuggestBackTooltip: "1 つ上へ戻る",
	pathSuggestDescendTooltip: "中身を見る",
	pathSuggestSelectHereTooltip: "現在の階層を選択",
	pathTemplateNone: "採番しない",
	batchRenumberTooltip: "一括再採番：このルールに一致する全ファイルを再採番",
	batchRenumberNoneTooltip: "このルールは「採番しない」のため、一括採番の対象がありません",
	batchModalTitle: "一括再採番",
	batchModalBody: (pattern, count) =>
		`「${pattern}」に一致する ${count} 個のファイルを、それぞれ適用中のテンプレートで再採番します。` +
		"「採番しない」、frontmatter でオフ、または未引き継ぎの外部番号を含むファイルは自動でスキップされます。開いているファイルは元に戻せますが、開いていないものは直接書き換えられます。",
	batchModalConfirm: "再採番",
	batchModalCancel: "キャンセル",
	pathColMode: "番号付け",
	pathModeWrite: "ファイルに書き込む",
	pathModeVirtual: "表示のみ",
	pathModeTooltip:
		"ファイルに書き込む：番号がノートに書き込まれ、外部エディタ・GitHub・Publish でも見えます。表示のみ：番号は Obsidian 内でだけ表示され、ノートの内容は 1 文字も変わりません。",
	batchRenumberVirtualTooltip:
		"このルールは「表示のみ」で番号を書き込まないため、一括採番は不要です",
	modeModalTitle: "採番モードの変更",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} 個のファイルにこのプラグインが書き込んだ番号があります。変更後はこれらのファイルへ番号を書き込みません` +
		`（${toVirtual} 個は表示のみ、${toNone} 個は採番なしになります）。`,
	modeModalClearLabel:
		"これらのファイルからこのプラグインが書き込んだ番号を消去します（手書きの番号は対象外）。チェックしない場合は既存の番号を残し、表示のみになるファイルには古い番号が残っている旨が表示されます。",
	modeModalEntering: (count) =>
		`${count} 個のファイルが「表示のみ」から「ファイルに書き込む」に変わります。`,
	modeModalWriteLabel:
		"これらのファイルに今すぐ番号を書き込む（チェックしない場合は次回の編集時に書き込み。開いているファイルはすぐ更新されます）",
	modeModalConfirm: "確認",
	noticeModeCleared: (count) =>
		`${count} 個のファイルから、このプラグインが書き込んだ番号を消去しました`,

	templatesHeading: "テンプレート",
	templatesDesc:
		"各レベルの見出しの番号書式と除外リストを定義します。どのファイルがどのテンプレートを使うかは、上の「パスルール」で決まります。",
	addTemplate: "テンプレートを追加",
	deleteBtn: "削除",

	topLevelName: "採番の開始レベル",
	bottomLevelName: "採番の終了レベル",
	ancestorSelf: "それぞれの書式（1.a.①）",
	ancestorArabic: "アラビア数字に統一（一 / 1.1）",

	colLevel: "レベル",
	colPrefix: "接頭辞",
	colNumeral: "番号",
	colNumberSep: "番号の区切り",
	colSuffix: "接尾辞",
	colTitleSep: "見出しとの区切り",
	colPreview: "プレビュー",
	inheritDepthAll: "すべて",
	previewHeadingWord: "見出し",

	skipFillFill: "埋める",
	skipFillDrop: "埋めない（その段を省略）",
	skipFillNone: "採番しない（そのまま）",

	numeralCjk: "一, 二, 三",

	matchExact: "全体",
	matchPartial: "部分",
	matchSubtree: "サブツリー",

	wlInputPlaceholder: "語句を入力して Enter で追加…",
	wlFilterPlaceholder: "項目を検索…",
	wlSortAdded: "追加順",
	wlSortAz: "A–Z 順",
	wlSortMatch: "一致方法順",
	wlFilterNoMatch: "（検索語に一致する項目はありません）",
	wlEmpty:
		"項目がありません。上に語句を入力して Enter で追加すると、一致した見出しは採番されません。",
	wlEditTitle: "クリックで語句を編集",
	wlChipWarnTitle:
		"一致した見出しの下に子見出しがあると、子見出しは除外されず、直前の採番済みの祖先にぶら下がってしまいます。「サブツリー」の使用をおすすめします。",
	wlPreviewNoFile:
		"（見出しを含む Markdown ファイルを開くと、この除外リストの一致をプレビューできます）",
	wlPreviewNone: "現在のファイルに、この除外リストで除外される見出しはありません。",
	wlPreviewSome: (count, titles) =>
		`現在のファイルでは ${count} 個の見出しが除外されます：${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ 現在のファイルが実際に使っているのはテンプレート「${appliedName}」で、編集中のものではありません。以下のプレビューは仮定です。`,
	wlPreviewNoTemplate:
		"⚠ 現在のファイルはどのパスルールにも一致せず、自動採番されません。以下のプレビューは仮定です。",

	clearVaultName: "Vault 全体の番号を消去",
	clearVaultDesc: "全ノートからこのプラグインが書き込んだ番号を削除し、自動採番をオフにします。",
	clearVaultBtn: "Vault 全体の番号を消去…",
	freezeVaultName: "番号を確定して所有権を返す",
	freezeVaultDesc: "現在の番号を残し、不可視マーカーを外して、以後は自動採番しません。",
	freezeVaultBtn: "番号を確定…",
	retiredBannerTitle: "プラグインは番号の所有権を返しました",
	retiredBannerBody:
		"番号は通常のテキストとして残され、プラグインは現在いっさい自動採番しません。引き継ぎを再開するには、下のボタンを押し、対象ファイルで「他プラグインの見出し番号を整理」を実行してください。そうしないと、既存の番号が外部の番号とみなされて二重になります。",
	resumeBtn: "引き継ぎを再開",

	aboutLinkRepo: "GitHub リポジトリ",
	aboutLinkIssues: "問題を報告",

	aboutCreditsHeading: "謝辞",
	aboutCreditsIntro:
		"開発にあたり、以下のオープンソースプラグインの実装を参考にしました。感謝します。",
	aboutCreditPathSuggest: "パス入力のフォルダ／ファイル候補と一致方法の考え方",
	aboutCreditBacklinks: "バックリンク同期の最初の参考",
	aboutCreditWordJoiner: "不可視文字で番号の境界を示す方法の最初の参考",

	defaultTemplateDisplay: "既定",

	delModalTitle: (name) => `テンプレート「${name}」を削除`,
	delModalBody: (count) => `次の ${count} 件のパスルールがこのテンプレートを使っています：`,
	delModalEmptyPath: "（空のパス）",
	delModalRedirect: "削除後、これらのルールは次を使う",
	delModalDeleteRules: "これらのルールも削除",
	cancel: "キャンセル",
	confirmDelete: "削除する",

	clearVaultModalTitle: "Vault 全体の番号を消去",
	clearVaultTurnOffAuto: "自動採番も同時にオフにする",
	clearVaultTurnOffAutoHint: "（消した直後にまた採番されるのを防ぎます）",
	clearVaultModalBody:
		"まず「グローバル自動採番」をオフにし、Vault 全体からこのプラグインが書き込んだ番号の接頭辞を取り除いて、見出しだけの状態に戻します（「内部リンクを同期（バックリンク）」がオンならリンクも更新されます）。元に戻す履歴には残らないため、先にバックアップを取ることをおすすめします。続行しますか？",
	confirmClearVault: "Vault 全体を消去する",

	freezeVaultModalTitle: "番号を確定して所有権を返す",
	freezeVaultModalBody:
		"確定すると：① Vault 全体の番号がそのまま通常のテキストとして残ります。② すべての不可視マーカー（リンクのアンカー内も含む。[[ノート#見出し]] は引き続き解決されます）を削除します。③ プラグインはあらゆる自動採番を停止します（frontmatter のスイッチより優先）。④ 元に戻す履歴には残らないため、先にバックアップを取ることをおすすめします。⑤ 引き継ぎを再開する前に「他プラグインの見出し番号を整理」を実行しないと、番号が二重になります。続行しますか？",
	confirmFreezeVault: "確定して返す",

	foreignGuardModalTitle: "他プラグインの番号の疑い",
	foreignGuardModalBody: (count) =>
		`次の ${count} 件の見出しは番号付きに見えますが、あなたの手書きかどうか判断できません（「API 設計」「TODO リスト」などは誤判定の可能性があります）。既定ではすべて整理対象としてチェックされています。チェックを外すと原文を残し、プラグインはテンプレートに従って自分の番号を付けます：`,
	foreignGuardItemToggle: (before) => `「${before}」の外部番号を整理`,
	foreignGuardSearchPlaceholder: "見出しを検索…",
	foreignGuardSearchEmpty: "一致する見出しがありません",

	cmdToggle: "グローバル自動採番を切り替え",
	cmdRenumber: "現在のノートを再採番",
	cmdClear: "現在のノートの番号を消去",
	cmdClearForeign: "現在のノートの他プラグインの番号を整理",
	cmdClearStale: "現在のノートの残存番号を消去（表示のみモード）",
	cmdCopyOutline: "番号付きアウトラインをコピー",
	cmdCopySectionLink: "現在のセクションのリンクをコピー",
	cmdCopySectionEmbed: "現在のセクションの埋め込みリンクをコピー",
	cmdToggleHeadingSkip: "カーソル位置の見出しの採番をスキップ／再開",
	cmdPromoteSection: "現在のセクションを昇格",
	cmdDemoteSection: "現在のセクションを降格",
	cmdPromoteHeading: "現在の見出しだけ昇格（子見出しを除く）",
	cmdDemoteHeading: "現在の見出しだけ降格（子見出しを除く）",
	cmdChooseNoteTemplate: "現在のノートのテンプレートを選択…",
	cmdToggleNoteAuto: "現在のノートの自動採番を切り替え",
	menuToggleSkip: "この見出しの採番をスキップ",
	menuToggleSkipTree: "セクション全体の採番をスキップ（子見出しを含む）",
	menuCopySectionEmbed: "このセクションの埋め込みをコピー",
	cmdToggleSectionSkip: "カーソル位置のセクション全体の採番をスキップ／再開",
	menuCopySectionLink: "このセクションのリンクをコピー",
	menuAdjustHeading: "この見出しのレベルを変更",
	menuAdjustSection: "セクションのレベルを変更（子見出しを含む）",
	menuNoteSettings: "このノートの採番設定…",
	menuBack: "戻る",
	handleHint: "ドラッグでセクションごと移動 · 右クリックでメニュー",
	handleHintReading: "右クリックでメニュー",
	noticeSectionShiftOutOfRange:
		"このセクションには 1–6 レベルを超える見出しがあるため、何も変更しませんでした",
	noticeNoteTemplateNoRule:
		"このノートのパスでは採番が有効になっていません。先に設定でパスルールを追加してください",
	noticeNoteTemplateSet: (name) => `このノートはテンプレート「${name}」を使います`,
	noticeNoteAutoOn: "このノートを常に自動採番に設定しました",
	noticeNoteAutoOff: "このノートを自動採番しない設定にしました",
	noticeNoTemplates: "選べるテンプレートがありません",
	chooseTemplatePlaceholder: "このノートで使うテンプレートを選択…",
	chooseTemplateFollowRule: "（パスルールに従う。このノート個別の設定を解除）",
	noticeNoteTemplateCleared: "このノートはパスルールのテンプレートに戻りました",
	statusModeWrite: "書き込み",
	statusModeVirtual: "表示のみ",
	statusNoNumbering: "このノートは採番なし",
	statusPausedByNote: "このノートは一時停止中",
	statusMenuRule: (path) => `一致したルール：${path}`,
	statusMenuNoRule: "どのパスルールにも一致しません",
	statusMenuAutoFollow: "自動採番：全体設定に従う",
	statusMenuAutoOn: "自動採番：このノートは常に採番",
	statusMenuAutoOff: "自動採番：このノートは採番しない",
	statusMenuChangeTemplate: "テンプレートを変更…",
	statusMenuRenumber: "今すぐ再採番",
	statusMenuCopyOutline: "番号付きアウトラインをコピー",
	statusMenuClearStale: "残存番号を消去",
	statusMenuCleanForeign: "手書きの番号を整理…",
	noticeStaleCleared:
		"このプラグインが書き込んだ古い番号を消去しました。手書きの番号はそのままです",
	noticeNoStaleNumbering: "このファイルにこのプラグインが書き込んだ古い番号はありません",
	virtualStaleTooltip:
		"ファイルにこのプラグインが以前書き込んだ番号が残っています（エクスポート・Publish・外部エディタで見えます）。コマンド「このファイルの残存プラグイン番号を消去」で消せます",

	noticeEnabled: "グローバル自動採番を有効にしました",
	noticeDisabled: "グローバル自動採番を無効にしました",
	noticeNothingToClear: "現在のファイルに消去できる番号の接頭辞はありません",
	noticeCleared: "番号を消去しました",
	noticeClearedAndPaused:
		"番号を消去し、このファイルの自動採番を一時停止しました（プロパティ obsidian-auto-headings: false）。「今すぐ再採番」を実行すると引き継ぎを再開します。",
	noticeRenumberedAndResumed: "再採番し、このファイルの自動採番を再開しました",
	noticeClearedVault: (count) => `Vault 全体の番号を消去しました（${count} 個のファイルを変更）`,
	noticeFrozenVault: (count) =>
		`番号を確定して所有権を返しました（${count} 個のファイルを変更）。番号は通常のテキストとして残り、プラグインは自動採番を停止します`,
	noticeResumed:
		"引き継ぎを再開しました。確定済みの番号がファイルに残っている場合は、先に「他プラグインの見出し番号を整理」を実行してください",
	noticeNoRule: "現在のファイルはどのパスルールにも一致しないため、採番できません",
	noticeNoNumberingRule: "現在のファイルのパスは「採番しない」に設定されています",
	noticeVirtualModeFile:
		"現在のファイルは「表示のみ」モードです。番号は Obsidian 内でだけ表示され、ファイルには書き込まれません",
	noticeBatchNoMatch: "このルールに一致する Markdown ファイルはありません",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`一括再採番が完了しました：書き換え ${changed} 個、変更なし ${unchanged} 個、スキップ ${skipped} 個`,
	noticeRenumbered: "再採番しました",
	noticeNoChange: "変更の必要はありません",
	noticeNoForeign: "現在のファイルに整理できる外部番号はありません",
	noticeForeignCleared: "他プラグインの見出し番号を整理しました",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `処理しました：${cleaned} 件を整理、${kept} 件は原文を残して番号を付与`
			: `他プラグインの見出し番号を整理しました（${cleaned} 件）`,
	noticeBacklinksUpdated: (count) => `${count} 件の内部リンクを更新しました`,
	noticeBacklinksIntro:
		"他のファイルにある、このファイルの見出しを指す内部リンクを自動更新しました（リンク切れ防止。変更は書き換えられたファイルの元に戻す履歴には残りません）。不要な場合は 設定 → 全般 でオフにできます。この通知は一度だけ表示されます。",
	noticeNoActiveFile: "開いている Markdown ファイルがありません",
	noticeNoHeadings: "現在のファイルに見出しがありません",
	noticeOutlineCopied: (count) => `番号付きアウトラインをコピーしました（見出し ${count} 個）`,
	noticeCopyFailed: "クリップボードへのコピーに失敗しました",
	noticeSectionLinkCopied: (label) => `リンクをコピーしました：${label}`,
	noticeSectionEmbedCopied: (label) => `埋め込みリンクをコピーしました：${label}`,
	noticeForeignNumberingGuardAction: "確認して整理",
	noticeForeignGuardFileNotOpen:
		"このファイルはどのタブにも開かれていません。開き直してから整理してください",
	pathNoMatchHint: "どのルールにも一致しないノートは採番されません。",
	activeRuleTooltip: "現在のノートはこのルールを使用",
	moreActionsTooltip: "その他の操作",
	templateBuiltinTag: "組み込み",
	templateCardUsage: (rules, whitelist) =>
		`${rules} 件のルールで使用 · 除外リスト ${whitelist} 項目`,
	editBtn: "編集",
	templateActionsTooltip: "テンプレートの操作",
	cardSampleTitles: ["ドキュメントタイトル", "概要", "背景", "詳細", "要点", "補足"],
	editorKicker: "テンプレートを編集",
	renameTemplateTooltip: "テンプレート名を変更",
	editorTabFormat: "書式",
	editorTabWhitelist: "除外リスト",
	rangeLabel: "採番の範囲",
	rangeTo: "〜",
	startIndexLabel: "開始番号",
	startIndexHint: "0 にすると 0.1、0.2…… になります",
	moreRulesLabel: "その他のルール",
	ancestorLabel: "上位番号の書き方",
	skipLabel: "見出しレベルが飛んだとき",
	placeholderLabel: "プレースホルダー文字",
	colParents: "上位番号",
	inheritNone: "付けない",
	inheritLevels: (n) => `${n} レベル`,
	outOfRangeBefore: (top) => `採番範囲外です（採番は H${top} から）`,
	outOfRangeAfter: (bottom) => `採番範囲外です（採番は H${bottom} まで）`,
	previewTitle: "プレビュー",
	previewSample: "サンプル",
	previewCurrent: "現在のノート",
	previewNoHeadings: "このノートにはまだ見出しがありません。",
	previewTagWhitelist: "除外リスト",
	previewTagSkip: "スキップ",
	previewTagUnnumbered: "採番なし",
	previewSampleWords: [
		"ドキュメントタイトル",
		"概要",
		"背景",
		"動機",
		"詳細",
		"補足",
		"方法",
		"結論",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`変更はすぐ反映されます · ${rules} 件のルールの ${notes} 件のノートに影響（うち ${writeNotes} 件はファイルに書き込み）。`,
	footerUnused: "変更はすぐ反映されます · このテンプレートを使うパスルールはまだありません。",
	footerWhitelist: "変更はすぐ反映されます · 語句をクリックして編集できます。",
	doneBtn: "完了",
	editorQuickApply: "クイック適用",
	editorHistory: "履歴",
	quickRecentHeading: "最近使った書式",
	quickPresetHeading: "よく使う採番体系",
	quickNoRecent: "保存された書式はまだありません",
	presetDecimal: "数字の階層 · 1 / 1.1 / 1.1.1",
	presetChapter: "章節 · 第一章 / 第一節",
	presetOfficial: "公文書 · 一、/（一）/ 1.",
	presetLegal: "法令条文 · 第一編 / 第一章 / 第一条",
	presetOutline: "アウトライン · I. / A. / 1.",
	historyTitle: (name) => `「${name}」の書式履歴`,
	historyEmpty:
		"履歴はまだありません。書式を変更して編集ウィンドウを閉じると、ここにスナップショットが残ります。",
	historyRestore: "復元",
	historyCurrent: "現在と同じ",
	wlLegendIntro: "一致した見出しは採番せず、番号も消費しません：",
	wlLegendExact: "完全一致",
	wlLegendPartial: "語句を含む",
	wlLegendSubtree: "セクション全体を除外し、その後は採番し直す",
	maintVaultHeading: "Vault 全体",
	maintVaultMeta: "元に戻せません。操作前にバックアップを推奨",
	noticeStaleNotVirtual:
		"このノートは「表示のみ」モードではないため、消去する残存番号はありません。",
	confirmWordPrompt: (word) => `確認のため「${word}」と入力`,
	clearVaultWord: "消去",
	freezeVaultWord: "確定",
	aboutDescription:
		"テンプレートに従って見出しに自動で番号を振ります。表示のみにも、ノートへの書き込みにも対応。見出しを改名すると、それを指すリンクも自動で追従します。",
	foreignGuardSelectAll: "すべて選択",
	foreignGuardSelected: (selected, total) => `${selected} / ${total} 件を選択`,
	foreignGuardUndoHint: "このノートの変更は Ctrl+Z で元に戻せます",
	foreignGuardConfirmCount: (count) => `${count} 件を整理する`,
	noticeForeignGuardCount: (count, virtual) =>
		`このノートには手書きの番号らしき見出しが ${count} 件あり、今回は${virtual ? "表示" : "自動採番"}されませんでした。`,
};

export default ja;
