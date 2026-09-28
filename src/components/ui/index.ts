// ═══════════════════════════════════════════════════════════
// WARRIOR OS — UI kit barrel ("FORGE HUD")
// Import everything from '@/components/ui'. Live reference: /design-system.
// ═══════════════════════════════════════════════════════════

// ─── Actions ───
export { Button, IconButton } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, IconButtonVariant, IconButtonSize } from './Button';
export { Menu } from './Menu';
export type { MenuItem, MenuProps } from './Menu';

// ─── Form controls ───
export { Input, Textarea } from './Input';
export type { InputProps, TextareaProps } from './Input';
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';
export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';
export { Checkbox, Radio, RadioGroup } from './Checkbox';
export type { CheckboxProps, RadioProps, RadioGroupProps, RadioGroupOption } from './Checkbox';
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';
export { Slider } from './Slider';
export type { SliderProps } from './Slider';
export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedOption } from './SegmentedControl';
export { FieldShell } from './Field';
export type { FieldSize } from './Field';

// ─── Navigation & layout ───
export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';
export { AppLayout, SidebarNav, NavItem, AppHeader } from './AppLayout';
export type { AppLayoutProps, SidebarNavProps, NavItemProps, NavItemDef, NavSection, AppHeaderProps } from './AppLayout';
export { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarSpacer } from './Toolbar';
export type { ToolbarProps } from './Toolbar';

// ─── Content ───
export { Card, SectionHeader } from './Card';
export type { CardProps, SectionHeaderProps } from './Card';
export { Badge, Chip, Kbd, TONE_SOFT, TONE_SOLID, TONE_OUTLINE, TONE_DOT, TONE_TEXT } from './Badge';
export type { BadgeProps, ChipProps, KbdProps, Tone } from './Badge';
export { StatTile, Sparkline } from './StatTile';
export type { StatTileProps, SparklineProps } from './StatTile';
export { ProgressBar, PROGRESS_COLOR } from './ProgressBar';
export type { ProgressTone } from './ProgressBar';
export { ProgressRing } from './ProgressRing';
export { Avatar, getInitials } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';
export { Divider, Skeleton } from './Divider';
export type { DividerProps, SkeletonProps } from './Divider';
export { ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { AppIcon } from './AppIcon';
export type { AppIconProps, AppIconSize } from './AppIcon';

// ─── Overlays ───
export { Dialog, ConfirmDialog } from './Dialog';
export type { DialogProps, ConfirmDialogProps, DialogSize } from './Dialog';
export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipSide } from './Tooltip';

// ─── Helpers ───
export { renderIcon } from './icon';
export type { IconLike } from './icon';

// ─── Legacy API (restyled; prefer the components above in new code) ───
export { GlassPanel } from './GlassPanel';
export { GlowButton } from './GlowButton';
export { NeonBadge } from './NeonBadge';
export { Modal } from './Modal';
export { Toggle } from './Toggle';
export { Dropdown } from './Dropdown';
export { HolographicCard } from './HolographicCard';
export { AppLoading } from './AppLoading';

// ─── Effects ───
export { TypewriterText } from './TypewriterText';
export { GlitchText } from './GlitchText';
export { ScanlineOverlay } from './ScanlineOverlay';
export { HexGrid } from './HexGrid';
