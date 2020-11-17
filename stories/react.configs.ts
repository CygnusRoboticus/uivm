import { FieldConfig, GroupConfig, ItemConfig } from "../src/configs";
import { FieldControl, ItemControl } from "../src/controls";
import { SearchDefinition, TriggerDefinition } from "../src/executable";
import { FieldTypeMap } from "../src/typing";
import { Option } from "../src/search.types";
import { CustomRegistry } from "./registry";

export interface FormConfig extends GroupConfig<CustomConfigs, CustomRegistry>, FieldConfig<CustomRegistry> {
  type: "form";
}

export interface TextConfig extends FieldConfig<CustomRegistry> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<CustomRegistry> {
  type: "checkbox";
  label: string;
}

export interface SelectConfig<T> extends FieldConfig<CustomRegistry> {
  type: "select";
  label?: string;
  placeholder?: string;
  options: readonly SearchDefinition<
    CustomRegistry,
    Option<T>,
    T,
    object,
    CustomConfigs,
    FieldControl<unknown, CustomHints>,
    CustomHints
  >[];
}

export interface FormGroupConfig extends GroupConfig<CustomConfigs, CustomRegistry> {
  type: "formGroup";
}

export interface ButtonConfig extends ItemConfig<CustomRegistry> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: TriggerDefinition<CustomRegistry, CustomConfigs, ItemControl<CustomHints>, CustomHints>;
}

export interface MessageConfig extends ItemConfig<CustomRegistry> {
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

export type CustomConfigsTypes = FieldTypeMap<
  CustomConfigs,
  { type: "text" },
  never,
  { type: "checkbox" },
  never,
  never
>;
