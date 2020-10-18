import { never, Observable } from "rxjs";
import { AbstractFlags, ItemControl, Messages } from "./controls";
import { ExecutableDefinition, ExecutableRegistry } from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataTypeDefinition } from "./typing";

export interface ItemConfig<TFormInfo extends FormInfoBase> extends BaseItemConfig {
  flags?: {
    [flag in keyof TFormInfo["flags"]]: readonly ExecutableDefinition<
      TFormInfo["registry"]["flags"],
      Observable<boolean>
    >[];
  };
  triggers?: readonly ExecutableDefinition<TFormInfo["registry"]["triggers"], Observable<void>>[];
  messagers?: readonly ExecutableDefinition<TFormInfo["registry"]["messagers"], Observable<Messages | null>>[];
}

export interface FieldConfig<TFormInfo extends FormInfoBase> extends ItemConfig<TFormInfo>, BaseFieldConfig {
  validators?: readonly ExecutableDefinition<TFormInfo["registry"]["validators"], Observable<Messages | null>>[];
  disablers?: readonly ExecutableDefinition<TFormInfo["registry"]["flags"], Observable<boolean>>[];
  dataType?: FieldDataTypeDefinition;
}

export type GroupConfig<TFormInfo extends FormInfoBase> = ItemConfig<TFormInfo> & BaseGroupConfig<TFormInfo["config"]>;
export type ArrayConfig<TFormInfo extends FormInfoBase> = FieldConfig<TFormInfo> & BaseArrayConfig<TFormInfo["config"]>;
export type AnyConfig<TFormInfo extends FormInfoBase> =
  | TFormInfo["config"]
  | ItemConfig<TFormInfo>
  | FieldConfig<TFormInfo>
  | GroupConfig<TFormInfo>
  | ArrayConfig<TFormInfo>;

export type FormConfig<TFormInfo extends FormInfoBase> = readonly TFormInfo["config"][];

export interface FormInfoBase {
  config: ItemConfig<this>;
  registry: ExecutableRegistry;
  flags: AbstractFlags;
}

export interface OptionSingle<T = unknown> {
  label: string;
  value: T;
  disabled?: boolean;
  sublabel?: string;
  icon?: { name: string; color?: string; tooltip?: string };
  help?: string;
}

export interface OptionMulti<T = unknown, U = unknown> {
  label: string;
  /**
   * Value to uniquely identify group; not used in selection.
   */
  value: U;
  icon?: string;
  options: (Option<T> | string)[];
}

export type Option<T = unknown> = OptionSingle<T> | OptionMulti<T>;
