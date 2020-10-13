import { FieldDataTypeDefinition } from "./typing";

export interface ItemConfig {
  type: string;
}

export interface FieldConfig extends ItemConfig {
  name: string;
  dataType?: FieldDataTypeDefinition;
}

export interface GroupConfig<TFormItem extends ItemConfig = ItemConfig> extends ItemConfig {
  fields: readonly AnyConfig<TFormItem>[];
}

export interface ArrayConfig<TFormItem extends ItemConfig = ItemConfig> extends FieldConfig, GroupConfig<TFormItem> {
  array: true;
}

export type AnyConfig<TFormItem extends ItemConfig = ItemConfig> =
  | TFormItem
  | ItemConfig
  | FieldConfig
  | GroupConfig<TFormItem>
  | ArrayConfig<TFormItem>;

export type FormConfig<TFormItem extends ItemConfig = ItemConfig> = readonly AnyConfig<TFormItem>[];

export interface DynaOptionSingle<T = unknown> {
  label: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;
}

export interface DynaOptionMulti<T = unknown, U = unknown> {
  label: string;
  /**
   * Value to uniquely identify group; not used in selection.
   */
  value: U;
  icon?: string;
  options: (DynaOption<T> | string)[];
}

export type DynaOption<T = unknown> = DynaOptionSingle<T> | DynaOptionMulti<T>;

/**
 * A reference that is dependent on another field in the same dyna-form config.
 */
export interface DependentValueDefinition<T = unknown> {
  /**
   * Name of another field in the same dyna-form, this is an absolute path
   * from the root FormGroup.
   *
   * e.g. with a form like
   * {
   *   rootField,
   *   nested: {
   *     nested1,
   *     nested2,
   *     nested3
   *   }
   * }
   *
   * The field `rootField` can reference a nested field by setting this to
   * `nested.nested1`.
   */
  field: string;
  /**
   * A value for `field`. Depending on context, this can be used as a truthy
   * comparison.
   */
  value: T;
}

export function isFieldConfig(config: ItemConfig): config is FieldConfig {
  return config && !!(config as any).name;
}
export function isGroupConfig<TConfig extends ItemConfig>(config: ItemConfig): config is GroupConfig<TConfig> {
  return config && !!(config as any).fields;
}
export function isArrayConfig<TConfig extends ItemConfig>(config: ItemConfig): config is ArrayConfig<TConfig> {
  return isGroupConfig<TConfig>(config) && (config as any).array;
}
