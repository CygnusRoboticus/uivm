import { ItemControl } from "./controls";
import { AbstractHints, AbstractExtras, Observableish } from "./controls.types";

// Search resolver specific types
export interface OptionSingle<T = unknown> {
  label: string;
  /**
   * Unique identifier for value, useful when value is a complex type
   */
  key?: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;

  [key: string]: unknown;
}

export interface OptionMulti<T = unknown, U = unknown> {
  label: string;
  /**
   * Value to uniquely identify group; not used in selection.
   */
  key: string;
  icon?: string;
  options: Option<T>[];

  [key: string]: unknown;
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;

export interface SearchResolver<
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  TParams extends object,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  search(search: string, control: TControl, params: TParams): Observableish<readonly TValue[]>;
  resolve(value: TValue[], control: TControl, params: TParams): Observableish<readonly TValue[]>;
}
