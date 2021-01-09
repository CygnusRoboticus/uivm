import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "../src/configs";
import { FieldControl, ItemControl } from "../src/controls";
import { AbstractExtras, AbstractHints } from "../src/controls.types";
import { BasicRegistry, SearchDefinition, TriggerDefinition } from "../src/executable";
import { Option } from "../src/search";
import { FieldTypeMap } from "../src/typing";
import { BasicVisitorExtras } from "../src/visitor";

export interface FormConfig
  extends GroupConfig<CustomConfigs, BasicRegistry, CustomHints, CustomExtras>,
    FieldConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "form";
}

export interface TextConfig extends FieldConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "checkbox";
  label: string;
}

export interface SelectConfig<T = unknown> extends FieldConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "select";
  label?: string;
  placeholder?: string;
  options: readonly SearchDefinition<
    BasicRegistry,
    Option<T>,
    T,
    object,
    CustomConfigs,
    FieldControl<unknown, CustomHints>
  >[];
}

export interface ContainerConfig extends GroupConfig<CustomConfigs, BasicRegistry, CustomHints, CustomExtras> {
  type: "container";
}

export interface RepeaterConfig extends ArrayConfig<CustomConfigs, BasicRegistry, CustomHints, CustomExtras> {
  type: "repeater";
}

export interface ButtonConfig extends ItemConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: TriggerDefinition<BasicRegistry, CustomConfigs, ItemControl<CustomHints>>;
}

export interface MessageConfig extends ItemConfig<BasicRegistry, CustomHints, CustomExtras> {
  type: "message";
  title?: string;
  chrome?: "info" | "warning" | "success" | "error";
}

export type CustomConfigs =
  | FormConfig
  | TextConfig
  | ButtonConfig
  | MessageConfig
  | ContainerConfig
  | RepeaterConfig
  | CheckboxConfig
  | SelectConfig<unknown>;

export type CustomHints = {
  hidden: boolean;
} & AbstractHints;

export type CustomExtras<TConfigs extends CustomConfigs = CustomConfigs> = BasicVisitorExtras<
  TConfigs,
  BasicRegistry,
  CustomHints,
  AbstractExtras
>;

export type CustomConfigsTypes = FieldTypeMap<
  CustomConfigs,
  { type: "text" },
  never,
  { type: "checkbox" },
  never,
  never,
  never
>;
