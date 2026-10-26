// ko 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** 한국어; 없는 키는 영어로 대체됩니다. */
const ko: Partial<Messages> = {
	tabGeneral: "일반",
	tabTemplates: "경로 및 템플릿",
	tabMaintenance: "유지 관리",
	tabAbout: "정보",

	languageName: "언어",
	languageDesc: "설정 화면과 명령어의 표시 언어.",
	langAuto: "자동 (Obsidian 따라가기)",
	languageChangeHint: "명령어 이름은 플러그인을 다시 불러오면 바뀝니다.",

	autoNumberName: "전역 자동 번호 매기기",
	autoNumberDesc: "편집하면서 제목에 번호를 매깁니다. 끄면 '지금 다시 번호 매기기'를 사용하세요.",

	debounceName: "입력 지연",
	debounceDesc: (min, max, def) =>
		`입력을 멈춘 뒤 번호를 매기기까지의 시간 (${min}–${max} ms, 기본 ${def}).`,
	resetTooltip: (def) => `기본값(${def} ms)으로 되돌리기`,

	updateBacklinksName: "내부 링크 동기화 (백링크)",
	updateBacklinksDesc: "제목 텍스트가 바뀌면 다른 노트의 링크도 함께 고칩니다.",

	headingLinkSuggestName: "입력할 때 제목 링크 제안",
	headingLinkSuggestDesc:
		"보관소의 제목과 같은 글자를 입력하면 제안하고 Tab으로 링크를 넣습니다.",
	headingSuggestThisFile: "(이 파일)",
	noticeHeadingIndexTruncated: (indexed) =>
		`보관함이 너무 커서 제목 색인을 일부만 만들었습니다 (${indexed}개 색인됨). 제안은 색인된 범위에서 동작합니다.`,
	vcTargetName: "제안을 표시할 곳",
	vcTargetDesc: "이 플러그인의 창이 VC의 창을 덮습니다. VC를 고르면 제목도 VC 창에 나옵니다.",
	vcTargetPlugin: "이 플러그인의 제안 창",
	vcTargetVc: "Various Complements의 제안 창",

	sectionInterface: "인터페이스",
	sectionNumbering: "자동 번호 매기기",
	sectionLinking: "링크 관리",
	sectionSuggest: "제목 링크 제안",
	sectionNoteEntry: "메뉴",
	headingMenuName: "제목 메뉴",
	headingMenuDesc: "제목 왼쪽 화살표를 오른쪽 클릭: 레벨 변경, 번호 건너뛰기, 링크 복사.",
	statusBarMenuName: "상태 표시줄 메뉴",
	statusBarMenuDesc:
		"상태 표시줄에 번호 상태를 표시하며, 클릭하면 자동 번호나 템플릿을 바꿀 수 있습니다.",

	vcNotInstalledNotice:
		"Various Complements를 찾을 수 없습니다 (설치되지 않았거나 비활성화됨). 자동 설정을 취소했습니다. 먼저 설치하고 활성화하거나 '수동 설정'을 사용하세요.",
	vcDictionaryPathLabel: "사전 파일 경로",
	vcCopyPathButton: "경로 복사",
	noticeVcPathCopied: "사전 파일 경로를 복사했습니다.",
	vcManualConfirmTitle: "수동 연동 켜기",
	vcManualConfirmBody:
		"플러그인 폴더에 제목 사전 파일을 만들고 관리합니다 (VC 설정은 바꾸지 않습니다). 경로를 복사해 VC의 'Custom dictionary paths'에 붙여 넣고 'Custom dictionary complement'를 켜세요. 'Displayed text suffix'는 비워 두는 것이 좋습니다. 그렇지 않으면 후보가 '제목 => ...'로 표시됩니다.",
	vcManualConfirmButton: "사전 파일 만들기",
	vcAutoConfirmTitle: "자동 연동 켜기",
	vcAutoConfirmBody:
		"제목 사전을 만들고 VC를 자동으로 설정합니다 (항상 안전 확인을 거치며, 안전하게 쓸 수 없으면 기존 설정을 건드리지 않고 중단합니다). 계속할까요?",
	vcAutoConfirmPoints: [
		"제목 사전 생성 및 관리 (최대 2만 개, 초과분은 잘림)",
		"VC 설정 쓰기: 사전 경로, 'Custom dictionary complement' 켜기, 트리거 기준 2글자 이상",
		"VC의 'Displayed text suffix' 비우기 (전역 항목이라 다른 사전의 후보에도 적용)",
		"VC의 'Max number of suggestions'를 10 이상으로 올리기 (전역 항목, 올리기만 함)",
		"쓴 뒤 VC 사전을 자동으로 다시 불러오기 (실패하면 따로 알림)",
	],
	vcDescriptionOffHint:
		"VC가 후보의 출처 줄을 숨기고 있습니다 (Description on suggestion: None).",
	vcOffConfirmTitle: "사전 연동 중지",
	vcOffConfirmBody:
		"이후 제목 사전은 더 이상 갱신되지 않습니다. Various Complements에는 이 사전이 아직 등록되어 있습니다. 함께 제거할까요? 제거하지 않으면 VC가 갱신되지 않는 오래된 사전을 계속 사용합니다 (제목을 바꾼 뒤 잘못된 링크가 들어갈 수 있습니다).",
	vcOffKeepButton: "유지",
	vcOffRemoveButton: "VC에서 제거",
	vcStaleDictName: "VC가 오래된 제목 사전을 계속 불러오는 중",
	vcStaleDictDesc: "이 사전은 갱신되지 않으며, 제목을 바꾸면 잘못된 링크가 들어갈 수 있습니다.",
	vcStaleDictRemoveButton: "제거",
	noticeVcDictRemoved: "Various Complements에서 이 플러그인의 제목 사전을 제거했습니다.",
	noticeVcDictRemoveFailed:
		"Various Complements 설정을 읽지 못했습니다. VC 설정에서 이 사전 경로를 직접 삭제해 주세요.",
	vcAutoConfirmButton: "확인 후 자동 설정",
	vcAutoManualButton: "수동 설정",
	noticeVcAutoWriteSuccess: "Various Complements 연동을 자동으로 설정했습니다.",
	noticeVcAutoWriteInvalidShape:
		"VC 설정 형식이 예상과 달라 자동 쓰기를 중단했습니다 (VC 설정은 그대로). '수동 설정'을 사용하거나 VC 설정 파일을 확인하세요.",
	noticeVcAutoWriteNotInstalled:
		"VC를 자동으로 설정하지 못했습니다 (미설치, 비활성화 또는 데이터 파일 없음). 먼저 설치하고 활성화하거나 '수동 설정'을 사용하세요.",
	noticeVcReloadFailed:
		"사전과 VC 설정은 썼지만 사전 자동 다시 불러오기에 실패했습니다. VC의 'Reload custom dictionaries' 명령을 직접 실행하거나 Obsidian을 다시 시작하세요.",
	noticeVcDictionaryTruncated: (total) =>
		`제목 총수(${total})가 사전 한도를 넘어 사전을 잘랐습니다. 제안은 수록된 범위에서 동작합니다.`,

	pathRulesHeading: "경로 규칙",
	pathRulesDesc:
		"경로를 템플릿에 연결합니다. 폴더 규칙은 '/'로 끝나고, '/' 루트 규칙이 전체 기본값이며, 가장 구체적인 규칙이 우선합니다.",
	pathNoRootWarn:
		"⚠ 루트 경로 규칙(/)이 없습니다. '전역 자동 번호 매기기'가 켜져 있어도 어느 규칙에도 맞지 않는 파일은 번호가 매겨지지 않습니다.",
	addRootRule: "+ / 루트 규칙 추가",
	addRule: "규칙 추가",
	pathColPattern: "경로",
	pathColTemplate: "템플릿",
	pathEmpty: "(아직 규칙이 없습니다. '/' 루트 규칙을 추가하면 보관함 전체에 적용됩니다.)",
	pathInputPlaceholder: "예: Projects/ 또는 독서 노트/딥 워크.md 또는 /",
	templateMissingSuffix: (name) => `${name} (없음)`,
	clearInputTooltip: "이 경로 지우기",
	deleteRuleTooltip: "이 규칙 삭제",
	dragHandleTooltip: "끌어서 순서 바꾸기",
	pathDuplicateWarn: (otherRow) =>
		`이 경로는 ${otherRow}번 규칙이 이미 사용 중입니다. 경로 하나에는 템플릿 하나만 연결할 수 있으니 둘 중 하나를 고치거나 삭제하세요.`,
	pathSuggestEmptyFolder: "(이 폴더는 비어 있습니다)",
	pathSuggestBackTooltip: "상위로 이동",
	pathSuggestDescendTooltip: "하위 항목 보기",
	pathSuggestSelectHereTooltip: "현재 단계 선택",
	pathTemplateNone: "번호 없음",
	batchRenumberTooltip: "일괄 다시 번호 매기기: 이 규칙에 맞는 모든 파일에 번호를 다시 매깁니다",
	batchRenumberNoneTooltip: "이 규칙은 '번호 없음'이라 일괄 번호 매기기 대상이 없습니다",
	batchModalTitle: "일괄 다시 번호 매기기",
	batchModalBody: (pattern, count) =>
		`'${pattern}'에 맞는 Markdown 파일 ${count}개에 각각 적용 중인 템플릿으로 번호를 다시 매깁니다. ` +
		"'번호 없음', frontmatter로 꺼진 파일, 인수하지 않은 외부 번호가 있는 파일은 건너뜁니다. " +
		"열려 있는 파일은 되돌릴 수 있고, 열려 있지 않은 파일은 바로 덮어씁니다.",
	batchModalConfirm: "다시 번호 매기기",
	batchModalCancel: "취소",
	pathColMode: "번호 방식",
	pathModeWrite: "파일에 쓰기",
	pathModeVirtual: "표시만",
	pathModeTooltip:
		"파일에 쓰기: 번호가 노트에 기록되어 외부 편집기, GitHub, Publish에서도 보입니다. 표시만: 번호는 Obsidian 안에서만 보이고 노트 내용은 전혀 바뀌지 않습니다.",
	batchRenumberVirtualTooltip:
		"이 규칙은 '표시만'이라 번호를 쓰지 않으므로 일괄 번호 매기기가 필요 없습니다",
	modeModalTitle: "번호 모드 변경",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`이 플러그인이 쓴 번호가 있는 파일이 ${count}개 있으며, 변경 후에는 이 파일들에 번호를 쓰지 않습니다 ` +
		`(${toVirtual}개는 표시만, ${toNone}개는 번호 없음).`,
	modeModalClearLabel:
		"이 파일들에서 플러그인이 쓴 번호를 지웁니다 (직접 쓴 번호는 그대로). 선택하지 않으면 기존 번호가 남고, 표시만으로 바뀐 파일에는 남은 번호가 있다고 알려 줍니다.",
	modeModalEntering: (count) => `파일 ${count}개가 '표시만'에서 '파일에 쓰기'로 바뀝니다.`,
	modeModalWriteLabel:
		"이 파일들에 지금 번호 쓰기 (선택하지 않으면 다음 편집 때 기록되며, 열려 있는 파일은 바로 갱신)",
	modeModalConfirm: "확인",
	noticeModeCleared: (count) => `파일 ${count}개에서 플러그인이 쓴 번호를 지웠습니다`,

	templatesHeading: "템플릿",
	templatesDesc:
		"제목 단계별 번호 형식과 제외 목록을 정의합니다. 어떤 파일이 어떤 템플릿을 쓸지는 위의 '경로 규칙'이 정합니다.",
	addTemplate: "새 템플릿",
	deleteBtn: "삭제",

	topLevelName: "시작 단계",
	bottomLevelName: "끝 단계",
	ancestorSelf: "각자의 형식 (1.a.①)",
	ancestorArabic: "아라비아 숫자로 통일 (一 / 1.1)",

	colLevel: "단계",
	colPrefix: "접두사",
	colNumeral: "숫자",
	colNumberSep: "번호 구분자",
	colSuffix: "접미사",
	colTitleSep: "제목 구분자",
	colPreview: "미리보기",
	inheritDepthAll: "전체",
	previewHeadingWord: "제목",

	skipFillFill: "채우기",
	skipFillDrop: "생략 (해당 구간 제외)",
	skipFillNone: "번호 안 매기기 (그대로 두기)",

	matchExact: "전체",
	matchPartial: "부분",
	matchSubtree: "하위 트리",

	wlInputPlaceholder: "단어를 입력하고 Enter로 추가…",
	wlFilterPlaceholder: "항목 검색…",
	wlSortAdded: "추가한 순서",
	wlSortAz: "A–Z 순",
	wlSortMatch: "일치 방식 순",
	wlFilterNoMatch: "(검색어와 일치하는 항목이 없습니다)",
	wlEmpty:
		"아직 항목이 없습니다. 위에 단어를 입력하고 Enter를 누르세요. 일치하는 제목은 번호가 매겨지지 않습니다.",
	wlEditTitle: "클릭하여 편집",
	wlChipWarnTitle:
		"일치한 제목 아래에 하위 제목이 있으면 하위 제목은 제외되지 않고 앞선 번호 있는 상위 제목에 잘못 붙습니다. '하위 트리'를 쓰는 것을 권장합니다.",
	wlPreviewNoFile:
		"(제목이 있는 Markdown 파일을 열면 이 제외 목록의 일치 결과를 미리 볼 수 있습니다)",
	wlPreviewNone: "현재 파일에서 이 제외 목록으로 제외되는 제목이 없습니다.",
	wlPreviewSome: (count, titles) => `현재 파일에서 제목 ${count}개가 제외됩니다: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ 경로 규칙에 따르면 현재 파일은 편집 중인 템플릿이 아니라 '${appliedName}' 템플릿을 사용합니다. 아래 미리보기는 가정입니다.`,
	wlPreviewNoTemplate:
		"⚠ 현재 파일은 어느 경로 규칙에도 맞지 않아 자동으로 번호가 매겨지지 않습니다. 아래 미리보기는 가정입니다.",

	clearVaultName: "보관함 전체 번호 지우기",
	clearVaultDesc: "모든 노트에서 이 플러그인이 쓴 번호를 지우고 자동 번호 매기기를 끕니다.",
	clearVaultBtn: "보관함 번호 지우기…",
	freezeVaultName: "번호 확정 및 소유권 반환",
	freezeVaultDesc:
		"현재 번호를 남기고 보이지 않는 표식을 없애며, 이후 자동 번호 매기기를 멈춥니다.",
	freezeVaultBtn: "번호 확정…",
	retiredBannerTitle: "플러그인이 번호 소유권을 반환했습니다",
	retiredBannerBody:
		"번호는 일반 텍스트로 남아 있고 플러그인은 현재 자동으로 번호를 매기지 않습니다. 다시 맡기려면 아래 버튼을 누른 뒤 해당 파일에서 '외부 번호 정리'를 실행하세요. 그렇지 않으면 기존 번호가 외부 번호로 취급되어 번호가 이중으로 붙습니다.",
	resumeBtn: "관리 다시 시작",

	aboutLinkRepo: "GitHub 저장소",
	aboutLinkIssues: "문제 신고",

	aboutCreditsHeading: "감사의 말",
	aboutCreditsIntro: "개발 과정에서 다음 오픈 소스 플러그인의 구현 아이디어를 참고했습니다.",
	aboutCreditPathSuggest: "경로 입력의 폴더/파일 제안과 일치 방식",
	aboutCreditBacklinks: "백링크 동기화의 최초 참고",
	aboutCreditWordJoiner: "보이지 않는 문자로 번호 경계를 표시하는 방식의 최초 참고",

	defaultTemplateDisplay: "기본",

	delModalTitle: (name) => `템플릿 '${name}' 삭제`,
	delModalBody: (count) => `다음 경로 규칙 ${count}개가 이 템플릿을 사용 중입니다:`,
	delModalEmptyPath: "(빈 경로)",
	delModalRedirect: "삭제 후 이 규칙들이 사용할 템플릿",
	delModalDeleteRules: "이 규칙들도 삭제",
	cancel: "취소",
	confirmDelete: "삭제 확인",

	clearVaultModalTitle: "보관함 번호 지우기",
	clearVaultTurnOffAuto: "자동 번호 매기기도 함께 끄기",
	clearVaultTurnOffAutoHint: "(지우자마자 다시 매겨지는 것을 막습니다)",
	clearVaultModalBody:
		"먼저 '전역 자동 번호 매기기'를 끈 다음, 모든 Markdown 파일에서 이 플러그인이 쓴 번호 접두사를 떼어 내 제목만 남깁니다 ('내부 링크 동기화 (백링크)'가 켜져 있으면 링크도 함께 고칩니다). Obsidian의 되돌리기 기록에 남지 않으므로 먼저 백업하세요. 계속할까요?",
	confirmClearVault: "보관함 지우기 확인",

	freezeVaultModalTitle: "번호 확정 및 소유권 반환",
	freezeVaultModalBody:
		"확인하면: ① 보관함의 번호가 그대로 일반 텍스트로 남습니다. ② 보이지 않는 표식(U+2060)을 링크 앵커 안까지 포함해 모두 제거하며, [[노트#제목]]은 계속 연결됩니다. ③ 플러그인이 모든 자동 번호 매기기를 멈춥니다 (frontmatter 설정보다 우선). ④ 되돌리기 기록에 남지 않으므로 먼저 백업하세요. ⑤ 나중에 다시 맡기려면 먼저 '외부 번호 정리'를 실행해야 하며, 그렇지 않으면 번호가 이중으로 붙습니다. 계속할까요?",
	confirmFreezeVault: "확정 및 반환 확인",

	foreignGuardModalTitle: "플러그인이 아닌 번호로 의심됨",
	foreignGuardModalBody: (count) =>
		`다음 제목 ${count}개는 번호가 있는 것처럼 보이지만, 직접 쓴 것인지 확신할 수 없습니다 ('API 설계', 'TODO 목록' 등은 오탐일 수 있음). 기본적으로 모두 선택되어 있으며, 선택을 해제하면 원문을 그대로 두고 플러그인이 자체 번호를 추가합니다:`,
	foreignGuardItemToggle: (before) => `'${before}'의 외부 번호 정리`,
	foreignGuardSearchPlaceholder: "제목 검색…",
	foreignGuardSearchEmpty: "일치하는 제목이 없습니다",

	cmdToggle: "전역 자동 번호 매기기 켜기/끄기",
	cmdRenumber: "현재 노트 다시 번호 매기기",
	cmdClear: "현재 노트의 번호 지우기",
	cmdClearForeign: "현재 노트의 외부 제목 번호 정리",
	cmdClearStale: "현재 노트의 남은 번호 지우기 (표시만 모드)",
	cmdCopyOutline: "번호 있는 개요 복사",
	cmdCopySectionLink: "현재 섹션 링크 복사",
	cmdCopySectionEmbed: "현재 섹션 임베드 링크 복사",
	cmdToggleHeadingSkip: "커서 위치 제목의 번호 건너뛰기/되돌리기",
	cmdPromoteSection: "현재 섹션 올리기",
	cmdDemoteSection: "현재 섹션 내리기",
	cmdPromoteHeading: "현재 제목만 올리기 (하위 제목 제외)",
	cmdDemoteHeading: "현재 제목만 내리기 (하위 제목 제외)",
	cmdChooseNoteTemplate: "현재 노트의 템플릿 선택…",
	cmdToggleNoteAuto: "현재 노트의 자동 번호 매기기 켜기/끄기",
	menuToggleSkip: "이 제목의 번호 건너뛰기",
	menuToggleSkipTree: "섹션 전체의 번호 건너뛰기 (하위 제목 포함)",
	menuCopySectionEmbed: "섹션 임베드 복사",
	cmdToggleSectionSkip: "커서 위치 섹션 전체의 번호 건너뛰기/되돌리기",
	menuCopySectionLink: "섹션 링크 복사",
	menuAdjustHeading: "이 제목의 레벨 변경",
	menuAdjustSection: "섹션 레벨 변경 (하위 제목 포함)",
	menuNoteSettings: "이 노트의 번호 설정…",
	menuBack: "뒤로",
	handleHint: "끌어서 섹션 이동 · 오른쪽 클릭으로 메뉴",
	handleHintReading: "오른쪽 클릭으로 메뉴",
	noticeSectionShiftOutOfRange:
		"이 섹션의 제목이 1–6단계를 벗어나게 되어 아무것도 바꾸지 않았습니다",
	noticeNoteTemplateNoRule:
		"이 노트의 경로에는 번호 매기기가 켜져 있지 않습니다. 먼저 설정에서 경로 규칙을 추가하세요",
	noticeNoteTemplateSet: (name) => `이 노트는 이제 '${name}' 템플릿을 사용합니다`,
	noticeNoteAutoOn: "이 노트는 항상 자동으로 번호를 매기도록 설정했습니다",
	noticeNoteAutoOff: "이 노트는 자동으로 번호를 매기지 않도록 설정했습니다",
	noticeNoTemplates: "선택할 수 있는 템플릿이 없습니다",
	chooseTemplatePlaceholder: "이 노트에 사용할 템플릿 선택…",
	chooseTemplateFollowRule: "(경로 규칙 따르기 — 이 노트의 개별 설정 해제)",
	noticeNoteTemplateCleared: "이 노트는 다시 경로 규칙의 템플릿을 사용합니다",
	statusModeWrite: "쓰기",
	statusModeVirtual: "표시만",
	statusNoNumbering: "번호 없음",
	statusPausedByNote: "이 노트 일시 중지",
	statusMenuRule: (path) => `적용된 규칙: ${path}`,
	statusMenuNoRule: "맞는 경로 규칙이 없습니다",
	statusMenuAutoFollow: "자동 번호 매기기: 전역 설정 따르기",
	statusMenuAutoOn: "자동 번호 매기기: 이 노트는 항상",
	statusMenuAutoOff: "자동 번호 매기기: 이 노트는 안 함",
	statusMenuChangeTemplate: "템플릿 바꾸기…",
	statusMenuRenumber: "지금 다시 번호 매기기",
	statusMenuCopyOutline: "번호 있는 개요 복사",
	statusMenuClearStale: "남은 번호 지우기",
	statusMenuCleanForeign: "직접 입력한 번호 정리…",
	noticeStaleCleared: "플러그인이 쓴 이전 번호를 지웠습니다. 직접 쓴 번호는 그대로입니다",
	noticeNoStaleNumbering: "이 파일에는 플러그인이 쓴 이전 번호가 없습니다",
	virtualStaleTooltip:
		"파일에 플러그인이 예전에 쓴 번호가 남아 있습니다 (내보내기, Publish, 외부 편집기에서 보입니다). '이 파일의 남은 플러그인 번호 지우기' 명령으로 지울 수 있습니다",

	noticeEnabled: "전역 자동 번호 매기기를 켰습니다",
	noticeDisabled: "전역 자동 번호 매기기를 껐습니다",
	noticeNothingToClear: "현재 파일에 지울 번호 접두사가 없습니다",
	noticeCleared: "번호를 지웠습니다",
	noticeClearedAndPaused:
		"번호를 지우고 이 파일의 자동 번호 매기기를 일시 중지했습니다 (속성 obsidian-auto-headings: false). '지금 다시 번호 매기기'를 실행하면 다시 시작됩니다.",
	noticeRenumberedAndResumed: "다시 번호를 매기고 이 파일의 자동 번호 매기기를 재개했습니다",
	noticeClearedVault: (count) => `보관함 번호를 지웠습니다 (파일 ${count}개 변경)`,
	noticeFrozenVault: (count) =>
		`번호를 확정하고 소유권을 반환했습니다 (파일 ${count}개 변경). 번호는 일반 텍스트로 남고 자동 번호 매기기는 멈춥니다`,
	noticeResumed:
		"관리를 다시 시작했습니다. 파일에 확정된 번호가 남아 있다면 먼저 '외부 번호 정리'를 실행하세요",
	noticeNoRule: "현재 파일이 어느 경로 규칙에도 맞지 않아 번호를 매길 수 없습니다",
	noticeNoNumberingRule: "현재 파일의 경로는 '번호 없음'으로 설정되어 있습니다",
	noticeVirtualModeFile:
		"현재 파일은 '표시만' 모드입니다. 번호는 Obsidian에서만 보이고 파일에는 쓰지 않습니다",
	noticeBatchNoMatch: "이 규칙에 맞는 Markdown 파일이 아직 없습니다",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`일괄 번호 매기기 완료: 변경 ${changed}개, 변화 없음 ${unchanged}개, 건너뜀 ${skipped}개`,
	noticeRenumbered: "다시 번호를 매겼습니다",
	noticeNoChange: "바꿀 내용이 없습니다",
	noticeNoForeign: "현재 파일에 정리할 외부 번호가 없습니다",
	noticeForeignCleared: "외부 제목 번호를 정리했습니다",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `처리 완료: ${cleaned}개 정리, ${kept}개는 원문을 두고 번호를 추가`
			: `외부 제목 번호를 정리했습니다 (${cleaned}개)`,
	noticeBacklinksUpdated: (count) => `내부 링크 ${count}개를 고쳤습니다`,
	noticeBacklinksIntro:
		"이 파일의 제목을 가리키는 다른 파일의 내부 링크를 자동으로 고쳤습니다 (링크가 깨지지 않도록). 이 변경은 수정된 파일의 되돌리기 기록에 남지 않습니다. 필요 없다면 설정 → 일반에서 '내부 링크 동기화'를 끄세요. 이 안내는 한 번만 표시됩니다.",
	noticeNoActiveFile: "열려 있는 Markdown 파일이 없습니다",
	noticeNoHeadings: "현재 파일에 제목이 없습니다",
	noticeOutlineCopied: (count) => `번호 있는 개요를 복사했습니다 (제목 ${count}개)`,
	noticeCopyFailed: "클립보드에 복사하지 못했습니다",
	noticeSectionLinkCopied: (label) => `링크를 복사했습니다: ${label}`,
	noticeSectionEmbedCopied: (label) => `임베드 링크를 복사했습니다: ${label}`,
	noticeForeignNumberingGuardAction: "확인 후 정리",
	noticeForeignGuardFileNotOpen:
		"이 파일은 더 이상 어떤 탭에도 열려 있지 않습니다. 다시 열고 정리하세요",
	pathNoMatchHint: "어느 규칙에도 맞지 않는 노트는 번호가 매겨지지 않습니다.",
	activeRuleTooltip: "현재 노트가 이 규칙을 사용 중",
	moreActionsTooltip: "더 보기",
	templateBuiltinTag: "기본 제공",
	templateCardUsage: (rules, whitelist) => `규칙 ${rules}개에서 사용 · 제외 항목 ${whitelist}개`,
	editBtn: "편집",
	templateActionsTooltip: "템플릿 작업",
	cardSampleTitles: ["문서 제목", "개요", "배경", "세부 내용", "핵심", "참고"],
	editorKicker: "템플릿 편집",
	renameTemplateTooltip: "템플릿 이름 바꾸기",
	editorTabFormat: "형식",
	editorTabWhitelist: "제외 목록",
	rangeLabel: "번호 범위",
	rangeTo: "~",
	startIndexLabel: "시작 번호",
	startIndexHint: "0으로 하면 0.1, 0.2…가 됩니다",
	moreRulesLabel: "추가 규칙",
	ancestorLabel: "상위 번호 표기",
	skipLabel: "제목 단계를 건너뛸 때",
	placeholderLabel: "자리 표시 문자",
	colParents: "상위 번호",
	inheritNone: "없음",
	inheritLevels: (n) => `${n}단계`,
	outOfRangeBefore: (top) => `번호 범위 밖입니다 (번호는 H${top}부터)`,
	outOfRangeAfter: (bottom) => `번호 범위 밖입니다 (번호는 H${bottom}까지)`,
	previewTitle: "미리보기",
	previewSample: "예시",
	previewCurrent: "현재 노트",
	previewNoHeadings: "이 노트에는 아직 제목이 없습니다.",
	previewTagWhitelist: "제외 목록",
	previewTagSkip: "건너뜀",
	previewTagUnnumbered: "번호 없음",
	previewSampleWords: ["문서 제목", "개요", "배경", "동기", "세부 내용", "참고", "방법", "결론"],
	footerImpact: (rules, notes, writeNotes) =>
		`변경 사항은 즉시 적용됩니다 · 규칙 ${rules}개에 걸친 노트 ${notes}개에 영향, 그중 ${writeNotes}개는 파일에 기록.`,
	footerUnused: "변경 사항은 즉시 적용됩니다 · 이 템플릿을 쓰는 경로 규칙이 아직 없습니다.",
	footerWhitelist: "변경 사항은 즉시 적용됩니다 · 단어를 클릭해 수정하세요.",
	doneBtn: "완료",
	editorQuickApply: "빠른 적용",
	editorHistory: "기록",
	quickRecentHeading: "최근 사용한 스타일",
	quickPresetHeading: "자주 쓰는 번호 체계",
	quickNoRecent: "저장된 스타일이 아직 없습니다",
	presetDecimal: "숫자 계층 · 1 / 1.1 / 1.1.1",
	presetChapter: "장·절 · 第一章 / 第一节",
	presetOfficial: "공문 · 一、/（一）/ 1.",
	presetLegal: "법조문 · 第一编 / 第一章 / 第一条",
	presetOutline: "개요 · I. / A. / 1.",
	historyTitle: (name) => `'${name}'의 스타일 기록`,
	historyEmpty:
		"아직 기록이 없습니다. 스타일을 바꾸고 편집 창을 닫으면 여기에 스냅샷이 남습니다.",
	historyRestore: "복원",
	historyCurrent: "현재와 같음",
	wlLegendIntro: "일치한 제목은 번호를 매기지 않고 번호도 차지하지 않습니다:",
	wlLegendExact: "완전 일치",
	wlLegendPartial: "단어 포함",
	wlLegendSubtree: "섹션 전체 제외, 이후 번호 이어서",
	maintVaultHeading: "보관함 전체",
	maintVaultMeta: "되돌릴 수 없으니 먼저 백업하세요",
	noticeStaleNotVirtual: "이 노트는 '표시만' 모드가 아니어서 지울 남은 번호가 없습니다.",
	confirmWordPrompt: (word) => `확인하려면 '${word}'을(를) 입력하세요`,
	clearVaultWord: "지우기",
	freezeVaultWord: "확정",
	aboutDescription:
		"템플릿에 따라 제목에 자동으로 번호를 매깁니다. 표시만 하거나 노트에 기록할 수 있고, 제목 이름이 바뀌면 그 제목을 가리키는 링크도 함께 따라갑니다.",
	foreignGuardSelectAll: "모두 선택",
	foreignGuardSelected: (selected, total) => `${total}개 중 ${selected}개 선택`,
	foreignGuardUndoHint: "이 노트의 변경은 Ctrl+Z로 되돌릴 수 있습니다",
	foreignGuardConfirmCount: (count) => `${count}개 정리`,
	noticeForeignGuardCount: (count, virtual) =>
		`이 노트에는 직접 쓴 번호로 보이는 제목이 ${count}개 있어, 이번에는 번호를 ${virtual ? "표시하" : "자동으로 매기"}지 않았습니다.`,
};

export default ko;
