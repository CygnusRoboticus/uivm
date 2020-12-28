import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "../src/configs";
import { FieldControl, ItemControl } from "../src/controls";
import { BasicRegistry, SearchDefinition, TriggerDefinition } from "../src/executable";
import { Option } from "../src/search";
import { FieldTypeMap } from "../src/typing";

export interface FormConfig
  extends GroupConfig<CustomConfigs, typeof BasicRegistry>,
    FieldConfig<typeof BasicRegistry> {
  type: "form";
}

export interface TextConfig extends FieldConfig<typeof BasicRegistry> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<typeof BasicRegistry> {
  type: "checkbox";
  label: string;
}

export interface SelectConfig<T> extends FieldConfig<typeof BasicRegistry> {
  type: "select";
  label?: string;
  placeholder?: string;
  options: readonly SearchDefinition<
    typeof BasicRegistry,
    Option<T>,
    T,
    object,
    CustomConfigs,
    FieldControl<unknown, CustomHints>
  >[];
}

export interface FormGroupConfig extends GroupConfig<CustomConfigs, typeof BasicRegistry> {
  type: "formGroup";
}

export interface RepeaterConfig extends ArrayConfig<CustomConfigs, typeof BasicRegistry> {
  type: "repeater";
}

export interface ButtonConfig extends ItemConfig<typeof BasicRegistry> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: TriggerDefinition<typeof BasicRegistry, CustomConfigs, ItemControl<CustomHints>>;
}

export interface MessageConfig extends ItemConfig<typeof BasicRegistry> {
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
  | RepeaterConfig
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
  never,
  never
>;
