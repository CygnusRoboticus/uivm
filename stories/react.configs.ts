import { FieldConfig, GroupConfig, ItemConfig } from "../lib/configs";
import { FieldControl, ItemControl } from "../lib/controls";
import { AbstractHints, Executor } from "../lib/controls.types";
import { ExecutableDefinition, SearchDefinition } from "../lib/executable";
import { FieldTypeMap } from "../lib/typing";
import { CustomRegistry } from "./registry";

export interface FormConfig
  extends GroupConfig<CustomConfigs, CustomRegistry, AbstractHints>,
    FieldConfig<CustomRegistry, AbstractHints> {
  type: "form";
}

export interface TextConfig extends FieldConfig<CustomRegistry, AbstractHints> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<CustomRegistry, AbstractHints> {
  type: "checkbox";
  label: string;
}

export interface SelectConfig<T> extends FieldConfig<CustomRegistry, AbstractHints> {
  type: "select";
  label?: string;
  placeholder?: string;
  options: readonly SearchDefinition<
    CustomRegistry,
    FieldControl<unknown, AbstractHints>,
    unknown,
    object,
    AbstractHints
  >[];
}

export interface FormGroupConfig extends GroupConfig<CustomConfigs, CustomRegistry, AbstractHints> {
  type: "formGroup";
}

export interface ButtonConfig extends ItemConfig<CustomRegistry, AbstractHints> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: ExecutableDefinition<CustomRegistry["triggers"], Executor<ItemControl<AbstractHints>, void>>;
}

export interface MessageConfig extends ItemConfig<CustomRegistry, AbstractHints> {
  type: "message";
  title?: string;
  chrome?: "info" | "warning" | "success" | "error";
}

export type CustomConfigs =
  | FormConfig
  | TextConfig
  | ButtonConfig
  | MessageConfig
  | FormGroupConfig
  | CheckboxConfig
  | SelectConfig<unknown>;

export type CustomHints = {
  hidden: boolean;
} & Record<string, boolean>;

export type CustomConfigsTypes = FieldTypeMap<CustomConfigs, { type: "text" }, never, never, never, never>;
