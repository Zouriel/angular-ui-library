import type { IconSvgObject } from '@hugeicons/angular';
import TextIcon from '@hugeicons/core-free-icons/TextIcon';
import TextAlignLeftIcon from '@hugeicons/core-free-icons/TextAlignLeftIcon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Call02Icon from '@hugeicons/core-free-icons/Call02Icon';
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon';
import HashtagIcon from '@hugeicons/core-free-icons/HashtagIcon';
import Dollar01Icon from '@hugeicons/core-free-icons/Dollar01Icon';
import Calendar01Icon from '@hugeicons/core-free-icons/Calendar01Icon';
import Clock02Icon from '@hugeicons/core-free-icons/Clock02Icon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import CircleDotIcon from '@hugeicons/core-free-icons/CircleDotIcon';
import CheckListIcon from '@hugeicons/core-free-icons/CheckListIcon';
import TagsIcon from '@hugeicons/core-free-icons/TagsIcon';
import CheckmarkSquare02Icon from '@hugeicons/core-free-icons/CheckmarkSquare02Icon';
import ToggleOnIcon from '@hugeicons/core-free-icons/ToggleOnIcon';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import SlidersHorizontalIcon from '@hugeicons/core-free-icons/SlidersHorizontalIcon';
import FileUploadIcon from '@hugeicons/core-free-icons/FileUploadIcon';
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon';
import CalculatorIcon from '@hugeicons/core-free-icons/CalculatorIcon';
import HeadingIcon from '@hugeicons/core-free-icons/HeadingIcon';
import ParagraphIcon from '@hugeicons/core-free-icons/ParagraphIcon';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import RepeatIcon from '@hugeicons/core-free-icons/RepeatIcon';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Alert01Icon from '@hugeicons/core-free-icons/Alert01Icon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import DragDropVerticalIcon from '@hugeicons/core-free-icons/DragDropVerticalIcon';
import FileEditIcon from '@hugeicons/core-free-icons/FileEditIcon';
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon';
import Redo02Icon from '@hugeicons/core-free-icons/Redo02Icon';
import RefreshIcon from '@hugeicons/core-free-icons/RefreshIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Undo02Icon from '@hugeicons/core-free-icons/Undo02Icon';
import type { UiFbFieldType, UiFbStaticType } from './schema';

export const FIELD_ICONS: Record<UiFbFieldType, IconSvgObject> = {
  text: TextIcon,
  textarea: TextAlignLeftIcon,
  email: Mail01Icon,
  phone: Call02Icon,
  url: Link01Icon,
  number: HashtagIcon,
  currency: Dollar01Icon,
  date: Calendar01Icon,
  time: Clock02Icon,
  select: ArrowDown01Icon,
  radio: CircleDotIcon,
  checkboxes: CheckListIcon,
  multiselect: TagsIcon,
  checkbox: CheckmarkSquare02Icon,
  toggle: ToggleOnIcon,
  rating: StarIcon,
  slider: SlidersHorizontalIcon,
  file: FileUploadIcon,
  hidden: ViewOffIcon,
  calculated: CalculatorIcon,
};

export const STATIC_ICONS: Record<UiFbStaticType, IconSvgObject> = {
  heading: HeadingIcon,
  paragraph: ParagraphIcon,
  divider: MinusSignIcon,
};

export const GROUP_ICON = Layers01Icon;
export const REPEAT_ICON = RepeatIcon;

/**
 * Every icon the form builder draws. Import icons only through here: the
 * icon component renders <path> elements only, and a spec checks each one
 * (an icon built from <circle>s would silently render blank).
 */
export const FB_ICONS = {
  Add01Icon,
  Alert01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  CalculatorIcon,
  Calendar01Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckListIcon,
  CheckmarkSquare02Icon,
  CircleDotIcon,
  Clock02Icon,
  Copy01Icon,
  Delete02Icon,
  Dollar01Icon,
  DragDropVerticalIcon,
  FileEditIcon,
  FileUploadIcon,
  HashtagIcon,
  HeadingIcon,
  Layers01Icon,
  Link01Icon,
  Mail01Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  ParagraphIcon,
  Redo02Icon,
  RefreshIcon,
  RepeatIcon,
  Search01Icon,
  Settings02Icon,
  SlidersHorizontalIcon,
  StarIcon,
  TagsIcon,
  TextAlignLeftIcon,
  TextIcon,
  ToggleOnIcon,
  Undo02Icon,
  ViewOffIcon,
} as const satisfies Record<string, IconSvgObject>;
