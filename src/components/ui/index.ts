/**
 * JeniMcRich UI kit — import everything from "@/components/ui".
 * Server-safe unless noted: Modal, ToastProvider/useToast, DataTable and
 * Tabs are Client Components.
 */

export { cn } from "./cn";
export { controlClass } from "./control";

export { Badge, badgeBaseClass, type BadgeProps, type BadgeVariant } from "./badge";
export { ScorePill, scoreBand, type ScorePillProps, type ScoreBand } from "./score-pill";
export {
  StageBadge,
  PIPELINE_STAGES,
  type StageBadgeProps,
  type PipelineStage,
  type StageInput,
} from "./stage-badge";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { Spinner, type SpinnerProps } from "./spinner";

export { Input, type InputProps } from "./input";
export { Select, type SelectProps } from "./select";
export { Textarea, type TextareaProps } from "./textarea";
export { Label, type LabelProps } from "./label";
export { FieldError, type FieldErrorProps } from "./field-error";

export { Card, CardHeader, CardTitle, CardBody, CardFooter } from "./card";

export { Modal, type ModalProps } from "./modal";
export {
  ToastProvider,
  useToast,
  type ToastProviderProps,
  type ToastApi,
  type ToastVariant,
  type ToastOptions,
} from "./toast";

export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type SortDirection,
} from "./data-table";

export {
  Tabs,
  TabList,
  Tab,
  TabPanel,
  type TabsProps,
  type TabListProps,
  type TabProps,
  type TabPanelProps,
} from "./tabs";

export { EmptyState, type EmptyStateProps } from "./empty-state";
export {
  Skeleton,
  SkeletonText,
  SkeletonTable,
  type SkeletonProps,
  type SkeletonTextProps,
  type SkeletonTableProps,
} from "./skeleton";
