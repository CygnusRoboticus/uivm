import { ItemControl } from "./controls";
import { AbstractHints, AbstractExtras, Observableish } from "./controls.types";

// Search resolver specific types
export interface OptionSingle<T = unknown> {
  label: string;
  /**
   * Unique identifier for value. Allows comparisons to be made when values are a complex type.
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
   * Unique identifer for group.
   */
  key: string;
  icon?: { name: string; color?: string; tooltip?: string };
  options: Option<T>[];

  [key: string]: unknown;
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;

export interface SearchResolver<
  TControl extends ItemControl<THints, TExtras>,
  TOption,
  TValue,
  TParams extends object = any,
  THints extends AbstractHints = AbstractHints,
  TExtras extends AbstractExtras = AbstractExtras
> {
  search(search: string, control: TControl, params: TParams): Observableish<readonly TOption[]>;
  resolve(value: TValue[], control: TControl, params: TParams): Observableish<readonly TOption[]>;
}
