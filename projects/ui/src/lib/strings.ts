import { Injectable, InjectionToken, inject, signal, type Provider, type Signal } from '@angular/core';

/**
 * The library's own built-in words: names of icon-only buttons, default labels and placeholders, and
 * date names. English by default. Give an app's language with `provideUiStrings(uiStringsDv)` (or a
 * partial set: the rest stay English), and switch it at runtime with `UiStringsService.set(...)`:
 * every component reads the words live, so a language toggle needs no reload (0.46.0).
 * Text that comes from the app (titles, labels, items) is never here.
 *
 * Components with their own input for a word (ui-file-upload's label/hint, ui-split-button's
 * menuLabel, a placeholder input) use that input first. The form builder's and workflow editor's
 * own interface text is still English (README, "Built-in strings").
 */
export interface UiStrings {
  /** Close buttons of modal, drawer, bottom sheet, lightbox. */
  close: string;
  /** Dismiss buttons of toast, alert, hint. */
  dismiss: string;
  /** Combobox clear button. */
  clear: string;
  /** Multi-select clear button. */
  clearAll: string;
  /** Search input clear button. */
  clearSearch: string;
  /** Pagination arrows. */
  previousPage: string;
  nextPage: string;
  /** Calendar and date range picker arrows. */
  previousMonth: string;
  nextMonth: string;
  /** The date picker's calendar dialog. */
  chooseDate: string;
  /** The split button's menu (caret) button. */
  moreActions: string;
  /** File upload: the action (in bold) and what follows it. */
  uploadLabel: string;
  uploadHint: string;
  /** Hold button: what holding does (read with the button), and its confirm dialog. */
  holdHint: string;
  confirmTitle: string;
  confirm: string;
  cancel: string;
  /** Map: the zoom buttons, and placing the pin at the centre (keyboard / screen reader). */
  zoomIn: string;
  zoomOut: string;
  placePinAtCentre: string;
  /** Map: the "my location" button, its off state (location off or denied), and the "you are here" dot. */
  mapLocate: string;
  mapLocationOff: string;
  mapYourLocation: string;
  /** Map preview (0.43.0): the still map's one button, which opens the full map. */
  mapOpen: string;
  /** Map search area (0.44.0): the radius handle's name, and the radius in metres / kilometres
   *  (`{n}` is the number). */
  mapSearchArea: string;
  mapRadiusMeters: string;
  mapRadiusKilometers: string;
  /** Google sign-in button: Google's approved wordings (a translation must keep the meaning: signing
   *  in to this app with a Google account, not creating one). */
  googleSignIn: string;
  googleSignUp: string;
  googleContinue: string;
  googleSignInShort: string;
  /** Sidebar layout: the menu (burger) button, the drawer's close button (shown to keyboard and
   *  screen-reader users), and the drawer's name. */
  sidebarToggle: string;
  sidebarClose: string;
  sidebarLabel: string;
  /** Loading text and busy names: spinner, loading overlay, intro loader, text and code viewers, image picker. */
  loading: string;
  /** Gallery and media lightbox arrows. */
  previous: string;
  /** Gallery and media lightbox arrows. */
  next: string;
  /** Carousel arrows. */
  previousSlide: string;
  /** Carousel arrows. */
  nextSlide: string;
  /** Carousel dots (`{n}` is the slide number). */
  goToSlide: string;
  /** Carousel name (Flutter; the web carousel is named by the app). */
  carousel: string;
  /** Gallery viewer dialog. */
  imageViewer: string;
  /** Image viewer arrows. */
  previousImage: string;
  /** Image viewer arrows. */
  nextImage: string;
  /** Image viewer reset button. */
  resetView: string;
  /** The visible "Fit" on image and PDF viewer buttons. */
  fit: string;
  /** PDF viewer fit button. */
  fitPage: string;
  /** Canvas viewport fit button. */
  fitToView: string;
  /** Image viewer hint (Flutter). */
  doubleTapToZoom: string;
  /** Media play button. */
  play: string;
  /** Media pause button. */
  pause: string;
  /** Media seek slider. */
  seek: string;
  /** Media volume slider. */
  volume: string;
  /** Media speed control. */
  playbackSpeed: string;
  /** Video fullscreen button. */
  fullscreen: string;
  /** Video player name (Flutter). */
  video: string;
  /** Media lightbox thumbnail strip. */
  mediaSet: string;
  /** File explorer path. */
  path: string;
  /** File viewer "open" fallback (Flutter). */
  open: string;
  /** File viewer fallback (Flutter). */
  previewUnavailable: string;
  /** File explorer empty folder (Flutter). */
  emptyFolder: string;
  /** File viewer while the PDF viewer loads. */
  loadingPdf: string;
  /** PDF viewer toolbar. */
  pageControls: string;
  /** Pagination page buttons, PDF page (`{n}`). */
  page: string;
  /** PDF viewer and Flutter pagination status (`{n}`, `{total}`). */
  pageOf: string;
  /** Pagination default name. */
  pagination: string;
  /** Splitter gutter. */
  resizePanes: string;
  /** Resize handle default name. */
  resize: string;
  /** Breadcrumbs nav. */
  breadcrumb: string;
  /** Breadcrumbs collapsed items (`{n}`). */
  showMore: string;
  /** Anchor nav. */
  onThisPage: string;
  /** OTP input group. */
  otpLabel: string;
  /** OTP input boxes (`{n}`). */
  otpDigit: string;
  /** Remove buttons of chips, multi-select and chip input (`{label}`). */
  remove: string;
  /** Password input toggle. */
  showPassword: string;
  /** Password input toggle. */
  hidePassword: string;
  /** Colour picker swatch. */
  pickColor: string;
  /** Colour picker hex field. */
  hexColor: string;
  /** Colour picker hue slider (Flutter). */
  hue: string;
  /** Command palette dialog. */
  commandPalette: string;
  /** Command palette default placeholder. */
  commandPlaceholder: string;
  /** Empty results of combobox and command palette. */
  noResults: string;
  /** Search input and combobox default placeholder. */
  searchPlaceholder: string;
  /** Multi-select default placeholder. */
  selectPlaceholder: string;
  /** Date picker default placeholder. */
  datePlaceholder: string;
  /** Time picker (Flutter). */
  chooseTime: string;
  /** Date picker months view arrows. */
  previousYear: string;
  /** Date picker months view arrows. */
  nextYear: string;
  /** Date picker years view arrows. */
  previousYears: string;
  /** Date picker years view arrows. */
  nextYears: string;
  /** Date picker months grid (`{n}` is the year). */
  monthsOf: string;
  /** Date picker years grid (`{n}` is the range). */
  yearsRange: string;
  /** Date range picker value (`{start}`, `{end}`). */
  dateRange: string;
  /** Empty state default heading. */
  emptyHeading: string;
  /** Table empty text. */
  noData: string;
  /** Editable text placeholder. */
  empty: string;
  /** Checkbox group "select all". */
  selectAll: string;
  /** Table header checkbox. */
  selectAllRows: string;
  /** Table row checkbox (`{n}`). */
  selectRow: string;
  /** Table actions column. */
  actions: string;
  /** Segmented control default name. */
  options: string;
  /** Tabs default name. */
  tabs: string;
  /** Progress bar and circle default name. */
  progress: string;
  /** Rating default name. */
  rating: string;
  /** Meter warning text. */
  meterWarn: string;
  /** Meter over-limit text. */
  meterDanger: string;
  /** Number input stepper (`{label}`). */
  decrease: string;
  /** Number input stepper (`{label}`). */
  increase: string;
  /** Chip input placeholder. */
  addTag: string;
  /** Menubar overflow (Flutter). */
  menu: string;
  /** Context menu hint (Flutter). */
  showMenu: string;
  /** Drag-move default name (Flutter). */
  move: string;
  /** Drag-move hint (Flutter). */
  dragHint: string;
  /** Transform box rotate handle. */
  rotate: string;
  /** Sequencer playhead. */
  playhead: string;
  /** Sequencer rows. */
  dragToReorder: string;
  /** A "show both" map control an app adds (`UiMapControl` label); the library has no such control of its own. */
  mapShowBoth: string;
  /** Map name (Flutter). */
  mapLabel: string;
  /** Map pin name (Flutter). */
  mapChosenLocation: string;
  /** The map's compass button, which turns it back to north up (0.47.0). */
  mapResetNorth: string;
  /** Navigation view's name (0.47.0). */
  navLabel: string;
  /** Distance to the next maneuver (`{distance}`, e.g. "80 m"). */
  navIn: string;
  /** Before the maneuver after next. */
  navThen: string;
  /** The arrive step's heading when it has no instruction; and before the arrival time for screen readers. */
  navArrive: string;
  /** Button that brings the map back to following the person. */
  navRecenter: string;
  /** Button that ends navigation. */
  navEnd: string;
  /** Time left under an hour (`{min}`). */
  navMinutes: string;
  /** Time left in whole hours (`{h}`). */
  navHours: string;
  /** Time left over an hour (`{h}`, `{min}`). */
  navHoursMinutes: string;
  /** A distance in metres (`{n}`). */
  navMeters: string;
  /** A distance in kilometres (`{n}`). */
  navKilometers: string;
  /** The bottom bar for screen readers (`{time}` left, `{distance}` left, `{clock}` arrival). */
  navSummary: string;
  /** Image picker busy name (`{label}`). */
  adding: string;
  /** Calendar: the hint on today. (Flutter) */
  today: string;
  /** Date range picker: an end not chosen yet. (Flutter) */
  notSet: string;
  /** Calendar heading month button ({label} is the month). (Flutter) */
  chooseMonth: string;
  /** Calendar heading year button ({label} is the year). (Flutter) */
  chooseYear: string;
  /** Date picker field hint. (Flutter) */
  opensCalendar: string;
  /** Time picker field hint. (Flutter) */
  opensTimePicker: string;
  /** Time picker columns. (Flutter) */
  hours: string;
  /** Time picker columns. (Flutter) */
  minutes: string;
  /** Time picker columns. (Flutter) */
  seconds: string;
  /** Text field selection menu. (Flutter) */
  cut: string;
  /** Text field selection menu. (Flutter) */
  copy: string;
  /** Text field selection menu. (Flutter) */
  paste: string;
  /** Text field selection menu. (Flutter) */
  delete: string;
  /** Text field selection menu. (Flutter) */
  lookUp: string;
  /** Text field selection menu. (Flutter) */
  searchWeb: string;
  /** Text field selection menu. (Flutter) */
  share: string;
  /** Text field selection menu. (Flutter) */
  scanText: string;
  /** Form field required message ({label} is the field label). (Flutter) */
  fieldRequired: string;
  /** Form field required message when the field has no label. (Flutter) */
  thisField: string;
  /** Bottom sheet grip at its largest size. (Flutter) */
  sheetSmaller: string;
  /** Bottom sheet grip. (Flutter) */
  sheetLarger: string;
  /** Sidebar layout menu button hint while open. (Flutter) */
  navigationOpen: string;
  /** Timeline: the current item. (Flutter) */
  currentStep: string;
  /** Timeline: an upcoming item. (Flutter) */
  upcoming: string;
  /** Gallery thumbnail without alt text. */
  openImage: string;
  /** Image viewer without alt text. */
  image: string;
  /** Meter default name. */
  meter: string;
  /** File upload: the list of chosen files. (Flutter) */
  chosenFiles: string;
  /** Slider default name. */
  slider: string;

  /** Date names and formats (0.46.0) for the calendar, date picker and date range picker. `locale` is
   *  the locale Intl formats with; '' uses the app's `LOCALE_ID`. */
  locale: string;
  /** Month names, January first (12), long and short. Empty: from the locale. */
  months: readonly string[];
  monthsShort: readonly string[];
  /** Weekday names, Sunday first (7), long (screen readers) and short (the grid's heading). Empty: from the locale. */
  weekdays: readonly string[];
  weekdaysShort: readonly string[];
  /** The grids' first column: 0 Sunday to 6 Saturday. null: from the locale (Sunday when it says nothing). */
  firstDayOfWeek: number | null;
  /** A day as text when `months` is given: `{d}`, `{month}`, `{y}` (e.g. '{d} {month} {y}'). Empty: the locale's
   *  long date. `dateFormatShort` uses `monthsShort`; `monthYearFormat` is a calendar's heading. */
  dateFormat: string;
  dateFormatShort: string;
  monthYearFormat: string;
}

export const defaultUiStrings: UiStrings = {
  close: 'Close',
  dismiss: 'Dismiss',
  clear: 'Clear',
  clearAll: 'Clear all',
  clearSearch: 'Clear search',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  chooseDate: 'Choose a date',
  moreActions: 'More actions',
  uploadLabel: 'Click to upload',
  uploadHint: 'or drag & drop',
  holdHint: 'Press and hold to confirm',
  confirmTitle: 'Are you sure?',
  confirm: 'Confirm',
  cancel: 'Cancel',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  placePinAtCentre: 'Place the pin at the centre',
  mapLocate: 'Show my location',
  mapLocationOff: 'Location is off',
  mapYourLocation: 'Your location',
  mapOpen: 'Open map',
  mapSearchArea: 'Search area',
  mapRadiusMeters: '{n} m',
  mapRadiusKilometers: '{n} km',
  googleSignIn: 'Sign in with Google',
  googleSignUp: 'Sign up with Google',
  googleContinue: 'Continue with Google',
  googleSignInShort: 'Sign in',
  sidebarToggle: 'Toggle navigation',
  sidebarClose: 'Close navigation',
  sidebarLabel: 'Navigation',
  loading: 'Loading…',
  previous: 'Previous',
  next: 'Next',
  previousSlide: 'Previous slide',
  nextSlide: 'Next slide',
  goToSlide: 'Go to slide {n}',
  carousel: 'Carousel',
  imageViewer: 'Image viewer',
  previousImage: 'Previous image',
  nextImage: 'Next image',
  resetView: 'Reset view',
  fit: 'Fit',
  fitPage: 'Fit page',
  fitToView: 'Fit to view',
  doubleTapToZoom: 'Double tap to zoom',
  play: 'Play',
  pause: 'Pause',
  seek: 'Seek',
  volume: 'Volume',
  playbackSpeed: 'Playback speed',
  fullscreen: 'Fullscreen',
  video: 'Video',
  mediaSet: 'Everything in this set',
  path: 'Path',
  open: 'Open',
  previewUnavailable: 'Preview not available for this file type.',
  emptyFolder: 'Empty folder',
  loadingPdf: 'Loading PDF viewer…',
  pageControls: 'Page controls',
  page: 'Page {n}',
  pageOf: 'Page {n} of {total}',
  pagination: 'Pagination',
  resizePanes: 'Resize panes',
  resize: 'Resize',
  breadcrumb: 'Breadcrumb',
  showMore: 'Show {n} more',
  onThisPage: 'On this page',
  otpLabel: 'One-time code',
  otpDigit: 'Digit {n}',
  remove: 'Remove {label}',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  pickColor: 'Pick colour',
  hexColor: 'Hex colour',
  hue: 'Hue',
  commandPalette: 'Command palette',
  commandPlaceholder: 'Type a command or search…',
  noResults: 'No results',
  searchPlaceholder: 'Search…',
  selectPlaceholder: 'Select…',
  datePlaceholder: 'Select a date',
  chooseTime: 'Choose a time',
  previousYear: 'Previous year',
  nextYear: 'Next year',
  previousYears: 'Previous years',
  nextYears: 'Next years',
  monthsOf: 'Months of {n}',
  yearsRange: 'Years {n}',
  dateRange: 'From {start} to {end}',
  emptyHeading: 'Nothing here yet',
  noData: 'No data',
  empty: 'Empty',
  selectAll: 'Select all',
  selectAllRows: 'Select all rows',
  selectRow: 'Select row {n}',
  actions: 'Actions',
  options: 'Options',
  tabs: 'Tabs',
  progress: 'Progress',
  rating: 'Rating',
  meterWarn: 'Getting large',
  meterDanger: 'Over the limit',
  decrease: 'Decrease {label}',
  increase: 'Increase {label}',
  addTag: 'Add tag…',
  menu: 'Menu',
  showMenu: 'Show menu',
  move: 'Move',
  dragHint: 'Drag, or use the arrow keys',
  rotate: 'Rotate',
  playhead: 'Playhead',
  dragToReorder: 'Drag to reorder',
  mapShowBoth: 'Show both',
  mapLabel: 'Map',
  mapChosenLocation: 'Chosen location',
  mapResetNorth: 'Reset to north',
  navLabel: 'Navigation',
  navIn: 'in {distance}',
  navThen: 'Then',
  navArrive: 'Arrive',
  navRecenter: 'Recenter',
  navEnd: 'End',
  navMinutes: '{min} min',
  navHours: '{h} h',
  navHoursMinutes: '{h} h {min} min',
  navMeters: '{n} m',
  navKilometers: '{n} km',
  navSummary: '{time} left, {distance}, arrive at {clock}',
  adding: 'Adding {label}',
  today: 'Today',
  notSet: 'Not set',
  chooseMonth: 'Choose month, {label}',
  chooseYear: 'Choose year, {label}',
  opensCalendar: 'Opens a calendar',
  opensTimePicker: 'Opens a time picker',
  hours: 'Hours',
  minutes: 'Minutes',
  seconds: 'Seconds',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  delete: 'Delete',
  lookUp: 'Look up',
  searchWeb: 'Search',
  share: 'Share',
  scanText: 'Scan text',
  fieldRequired: '{label} is required',
  thisField: 'This field',
  sheetSmaller: 'Make smaller',
  sheetLarger: 'Make larger',
  navigationOpen: 'Navigation open',
  currentStep: 'Current step',
  upcoming: 'Upcoming',
  openImage: 'Open image',
  image: 'Image',
  meter: 'Meter',
  chosenFiles: 'Chosen files',
  slider: 'Slider',
  locale: '',
  months: [],
  monthsShort: [],
  weekdays: [],
  weekdaysShort: [],
  firstDayOfWeek: null,
  dateFormat: '',
  dateFormatShort: '',
  monthYearFormat: '',
};

/**
 * The library's words in Dhivehi (Thaana), complete, with Dhivehi month and day names (Intl has no `dv`
 * data). `provideUiStrings(uiStringsDv)`, or `inject(UiStringsService).set(uiStringsDv)` to switch at runtime;
 * set `<html dir="rtl" lang="dv">` with it.
 */
export const uiStringsDv: UiStrings = {
  close: 'ބަންދުކުރޭ',
  dismiss: 'ފޮރުވާލާ',
  clear: 'ފޮހެލާ',
  clearAll: 'ހުރިހާ އެއްޗެއް ފޮހެލާ',
  clearSearch: 'ހޯދުން ފޮހެލާ',
  previousPage: 'ކުރީ ޞަފްޙާ',
  nextPage: 'ދެން އޮތް ޞަފްޙާ',
  previousMonth: 'ކުރީ މަސް',
  nextMonth: 'ދެން އޮތް މަސް',
  chooseDate: 'ތާރީޚެއް ހޮވާ',
  moreActions: 'އިތުރު ކަންކަން',
  uploadLabel: 'ކްލިކްކޮށް އަޕްލޯޑް ކުރޭ',
  uploadHint: 'ނުވަތަ ދަމައިގެން ލާ',
  holdHint: 'ކަށަވަރުކުރަން ފިތާލައިގެން ހިފަހައްޓާ',
  confirmTitle: 'ޔަގީންތޯ؟',
  confirm: 'ކަށަވަރުކުރޭ',
  cancel: 'ކެންސަލް',
  zoomIn: 'ބޮޑުކުރޭ',
  zoomOut: 'ކުޑަކުރޭ',
  placePinAtCentre: 'ޕިން މެދަށް ލާ',
  mapLocate: 'އަހަރެން ހުރި ތަން ދައްކާ',
  mapLocationOff: 'ލޮކޭޝަން ނިވާލާފައި',
  mapYourLocation: 'ތިބާ ހުރި ތަން',
  mapOpen: 'މެޕް ހުޅުވާ',
  mapSearchArea: 'ހޯދާ ސަރަހައްދު',
  mapRadiusMeters: '{n} މީޓަރު',
  mapRadiusKilometers: '{n} ކިލޯމީޓަރު',
  googleSignIn: 'ގޫގުލްއިން ސައިން އިން ކުރޭ',
  googleSignUp: 'ގޫގުލްއިން ސައިން އަޕް ކުރޭ',
  googleContinue: 'ގޫގުލްއިން ކުރިއަށް',
  googleSignInShort: 'ސައިން އިން',
  sidebarToggle: 'މެނޫ',
  sidebarClose: 'މެނޫ ބަންދުކުރޭ',
  sidebarLabel: 'ނެވިގޭޝަން',
  loading: 'ލޯޑުވަނީ…',
  previous: 'ކުރީގެ',
  next: 'ދެން',
  previousSlide: 'ކުރީ ސްލައިޑް',
  nextSlide: 'ދެން އޮތް ސްލައިޑް',
  goToSlide: 'ސްލައިޑް {n} އަށް',
  carousel: 'ސްލައިޑްތައް',
  imageViewer: 'ފޮޓޯ ބަލާ',
  previousImage: 'ކުރީ ފޮޓޯ',
  nextImage: 'ދެން އޮތް ފޮޓޯ',
  resetView: 'ފުރަތަމަ ގޮތަށް',
  fit: 'ފިޓް',
  fitPage: 'ޞަފްޙާ ފިޓްކުރޭ',
  fitToView: 'ފެންނަ ގޮތަށް ފިޓްކުރޭ',
  doubleTapToZoom: 'ބޮޑުކުރަން ދެފަހަރު ފިތާލާ',
  play: 'ޕްލޭ',
  pause: 'ހުއްޓާ',
  seek: 'ތަން ބަދަލުކުރޭ',
  volume: 'އަޑު',
  playbackSpeed: 'ޕްލޭ ކުރާ މިންވަރު',
  fullscreen: 'ފުލް ސްކްރީން',
  video: 'ވީޑިއޯ',
  mediaSet: 'މި ސެޓްގައި ހުރިހާ އެއްޗެއް',
  path: 'މަގު',
  open: 'ހުޅުވާ',
  previewUnavailable: 'މި ބާވަތުގެ ފައިލް ބަލާކަށް ނުކެރޭ.',
  emptyFolder: 'ފޯލްޑަރު ހުސް',
  loadingPdf: 'ޕީޑީއެފް ލޯޑުވަނީ…',
  pageControls: 'ޞަފްޙާގެ ކޮންޓްރޯލް',
  page: 'ޞަފްޙާ {n}',
  pageOf: 'ޞަފްޙާ {n} / {total}',
  pagination: 'ޞަފްޙާތައް',
  resizePanes: 'ބައިތަކުގެ ސައިޒް ބަދަލުކުރޭ',
  resize: 'ސައިޒް ބަދަލުކުރޭ',
  breadcrumb: 'ތިބާ މިހުރި ތަން',
  showMore: 'އިތުރު {n} ދައްކާ',
  onThisPage: 'މި ޞަފްޙާގައި',
  otpLabel: 'އެއްފަހަރު ބޭނުންކުރާ ކޯޑު',
  otpDigit: 'ނަންބަރު {n}',
  remove: '{label} ނައްތާލާ',
  showPassword: 'ޕާސްވޯޑް ދައްކާ',
  hidePassword: 'ޕާސްވޯޑް ފޮރުވާ',
  pickColor: 'ކުލައެއް ހޮވާ',
  hexColor: 'ހެކްސް ކުލަ',
  hue: 'ކުލަ',
  commandPalette: 'ކޮމާންޑުތައް',
  commandPlaceholder: 'ކޮމާންޑެއް ލިޔޭ ނުވަތަ ހޯދާ…',
  noResults: 'އެއްވެސް އެއްޗެއް ނުފެނުނު',
  searchPlaceholder: 'ހޯދާ…',
  selectPlaceholder: 'ހޮވާ…',
  datePlaceholder: 'ތާރީޚެއް ހޮވާ',
  chooseTime: 'ވަގުތެއް ހޮވާ',
  previousYear: 'ކުރީ އަހަރު',
  nextYear: 'ދެން އޮތް އަހަރު',
  previousYears: 'ކުރީ އަހަރުތައް',
  nextYears: 'ދެން އޮތް އަހަރުތައް',
  monthsOf: '{n} ގެ މަސްތައް',
  yearsRange: 'އަހަރުތައް {n}',
  dateRange: '{start} އިން {end} އަށް',
  emptyHeading: 'މިތާ އަދި އެއްވެސް އެއްޗެއް ނެތް',
  noData: 'މަޢުލޫމާތެއް ނެތް',
  empty: 'ހުސް',
  selectAll: 'ހުރިހާ އެއްޗެއް ހޮވާ',
  selectAllRows: 'ހުރިހާ ލައިނެއް ހޮވާ',
  selectRow: 'ލައިން {n} ހޮވާ',
  actions: 'ކަންކަން',
  options: 'އިޚްތިޔާރުތައް',
  tabs: 'ޓެބްތައް',
  progress: 'ކުރިއެރުން',
  rating: 'ރޭޓިންގ',
  meterWarn: 'ބޮޑުވަމުން',
  meterDanger: 'ހައްދަށްވުރެ ބޮޑު',
  decrease: '{label} ކުޑަކުރޭ',
  increase: '{label} ބޮޑުކުރޭ',
  addTag: 'ޓެގެއް އިތުރުކުރޭ…',
  menu: 'މެނޫ',
  showMenu: 'މެނޫ ދައްކާ',
  move: 'ތަން ބަދަލުކުރޭ',
  dragHint: 'ދަމާ، ނުވަތަ އެރޯ ކީތައް ބޭނުންކުރޭ',
  rotate: 'އަނބުރާ',
  playhead: 'ޕްލޭހެޑް',
  dragToReorder: 'ތަރުތީބު ބަދަލުކުރަން ދަމާ',
  mapShowBoth: 'ދެބައިވެސް ދައްކާ',
  mapLabel: 'މެޕް',
  mapChosenLocation: 'ހޮވި ތަން',
  mapResetNorth: 'އުތުރު މައްޗަށް ގެންނާ',
  navLabel: 'މަގު ދެއްކުން',
  navIn: '{distance} ދުރުން',
  navThen: 'ދެން',
  navArrive: 'ވާސިލުވުން',
  navRecenter: 'މެދަށް ގެންނާ',
  navEnd: 'ނިންމާ',
  navMinutes: '{min} މިނެޓު',
  navHours: '{h} ގަޑިއިރު',
  navHoursMinutes: '{h} ގަޑިއިރު {min} މިނެޓު',
  navMeters: '{n} މީޓަރު',
  navKilometers: '{n} ކިލޯމީޓަރު',
  navSummary: '{time} ބާކީ، {distance}، {clock} ގައި ވާސިލުވާނެ',
  adding: '{label} އިތުރުކުރަނީ',
  today: 'މިއަދު',
  notSet: 'ކަނޑައަޅާފައެއް ނެތް',
  chooseMonth: 'މަސް ހޮވާ، {label}',
  chooseYear: 'އަހަރު ހޮވާ، {label}',
  opensCalendar: 'ކަލަންޑަރު ހުޅުވޭ',
  opensTimePicker: 'ވަގުތު ހޮވާ ތަން ހުޅުވޭ',
  hours: 'ގަޑި',
  minutes: 'މިނެޓު',
  seconds: 'ސިކުންތު',
  cut: 'ކަޓް',
  copy: 'ކޮޕީ',
  paste: 'ޕޭސްޓް',
  delete: 'ފޮހެލާ',
  lookUp: 'ބަލާ',
  searchWeb: 'ހޯދާ',
  share: 'ޝެއާ',
  scanText: 'ލިޔުން ސްކޭން ކުރޭ',
  fieldRequired: '{label} ލާޒިމް',
  thisField: 'މި ބައި',
  sheetSmaller: 'ކުޑަކުރޭ',
  sheetLarger: 'ބޮޑުކުރޭ',
  navigationOpen: 'ނެވިގޭޝަން ހުޅުވިފައި',
  currentStep: 'މިހާރު މިހުރި ފިޔަވަޅު',
  upcoming: 'ކުރިއަށް އޮތް',
  openImage: 'ފޮޓޯ ހުޅުވާ',
  image: 'ފޮޓޯ',
  meter: 'މީޓަރު',
  chosenFiles: 'ހޮވި ފައިލްތައް',
  slider: 'ސްލައިޑަރު',
  locale: 'dv',
  months: ['ޖަނަވަރީ', 'ފެބުރުއަރީ', 'މާރިޗު', 'އެޕްރީލް', 'މޭ', 'ޖޫން', 'ޖުލައި', 'އޯގަސްޓު', 'ސެޕްޓެމްބަރު', 'އޮކްޓޫބަރު', 'ނޮވެމްބަރު', 'ޑިސެމްބަރު'],
  monthsShort: ['ޖަނަވަރީ', 'ފެބުރުއަރީ', 'މާރިޗު', 'އެޕްރީލް', 'މޭ', 'ޖޫން', 'ޖުލައި', 'އޯގަސްޓު', 'ސެޕްޓެމްބަރު', 'އޮކްޓޫބަރު', 'ނޮވެމްބަރު', 'ޑިސެމްބަރު'],
  weekdays: ['އާދިއްތަ', 'ހޯމަ', 'އަންގާރަ', 'ބުދަ', 'ބުރާސްފަތި', 'ހުކުރު', 'ހޮނިހިރު'],
  weekdaysShort: ['އާދި', 'ހޯމަ', 'އަން', 'ބުދަ', 'ބުރާ', 'ހުކު', 'ހޮނި'],
  // The Maldivian work week starts on Sunday.
  firstDayOfWeek: 0,
  dateFormat: '{d} {month} {y}',
  dateFormatShort: '{d} {month} {y}',
  monthYearFormat: '{month} {y}',
};

/** Fills `{name}` placeholders in a built-in word: `uiFormatString(strings.remove, { label: 'Tea' })`. Unknown
 *  placeholders stay as they are. */
export function uiFormatString(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** The starting words given by `provideUiStrings` (English when none). */
const UI_STRINGS_INITIAL = new InjectionToken<UiStrings>('UI_STRINGS_INITIAL');

/**
 * The built-in words in effect, switchable at runtime (0.46.0): `set(uiStringsDv)` for Dhivehi,
 * `set({})` back to English. Components read them live, so they change in place.
 */
@Injectable({ providedIn: 'root' })
export class UiStringsService {
  private readonly current = signal<UiStrings>(inject(UI_STRINGS_INITIAL, { optional: true }) ?? defaultUiStrings);
  /** The full set in effect. */
  readonly strings: Signal<UiStrings> = this.current.asReadonly();
  /** The same words as a plain-looking object whose properties read the signal (what components use). */
  readonly view: UiStrings = liveView(this.current);

  /** Replaces the words: `strings` over English (a partial set keeps English for the rest). */
  set(strings: Partial<UiStrings>): void {
    this.current.set({ ...defaultUiStrings, ...strings });
  }

  /** Changes some words, keeping the others as they are now. */
  patch(strings: Partial<UiStrings>): void {
    this.current.update((s) => ({ ...s, ...strings }));
  }
}

function liveView(source: Signal<UiStrings>): UiStrings {
  const view = {} as UiStrings;
  for (const key of Object.keys(defaultUiStrings) as (keyof UiStrings)[]) {
    Object.defineProperty(view, key, { get: () => source()[key], enumerable: true });
  }
  return Object.freeze(view);
}

/** The words components read: a live view of {@link UiStringsService}. */
export const UI_STRINGS = new InjectionToken<UiStrings>('UI_STRINGS', { providedIn: 'root', factory: () => inject(UiStringsService).view });

/** The app's language for the built-in words (the rest stay English), e.g. `provideUiStrings(uiStringsDv)`.
 *  Switch later with `UiStringsService.set`. */
export function provideUiStrings(strings: Partial<UiStrings>): Provider {
  return [
    { provide: UI_STRINGS_INITIAL, useValue: { ...defaultUiStrings, ...strings } },
    UiStringsService,
    { provide: UI_STRINGS, useFactory: () => inject(UiStringsService).view },
  ];
}

/** The built-in words in effect (inside an injection context), read live. */
export function injectUiStrings(): UiStrings {
  return inject(UI_STRINGS, { optional: true }) ?? defaultUiStrings;
}
