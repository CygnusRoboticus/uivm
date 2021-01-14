import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "../src/configs";
import { FieldControl, ItemControl } from "../src/controls";
import { AbstractExtras, AbstractHints, Validator } from "../src/controls.types";
import { BasicRegistry, BasicValidatorsService, SearchDefinition, TriggerDefinition } from "../src/executable";
import { Option } from "../src/search";
import { FieldTypeMap } from "../src/typing";
import { BasicVisitorExtras } from "../src/visitor";

export class CustomRegistry<
  TConfigs extends CustomConfigs = CustomConfigs,
  TControl extends ItemControl = ItemControl
> extends BasicRegistry<TConfigs> {
  validators = new (class extends BasicValidatorsService<TConfigs> {
    demoMessage(config: TConfigs, control: TControl, params?: {}): Validator<any> {
      return (c: TControl) => ({ demoMessage: { message: "Demo Example Message" } });
    }
  })();
}

export interface FormConfig
  extends GroupConfig<CustomConfigs, CustomRegistry, CustomHints, CustomExtras>,
    FieldConfig<CustomRegistry, CustomHints, CustomExtras> {
  type: "form";
}

export interface TextConfig extends FieldConfig<CustomRegistry, CustomHints, CustomExtras> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<CustomRegistry, CustomHints, CustomExtras> {
  type: "checkbox";
  label: string;
}

export interface SelectConfig<T = unknown> extends FieldConfig<CustomRegistry, CustomHints, CustomExtras> {
  type: "select";
  label?: string;
  placeholder?: string;
  options: readonly SearchDefinition<
    CustomRegistry,
    Option<T>,
    T,
    object,
    CustomConfigs,
    FieldControl<any, CustomHints>
  >[];
}

export interface ContainerConfig extends GroupConfig<CustomConfigs, CustomRegistry, CustomHints, CustomExtras> {
  type: "container";
}

export interface RepeaterConfig extends ArrayConfig<CustomConfigs, CustomRegistry, CustomHints, CustomExtras> {
  label?: string;
  type: "repeater";
}

export interface ButtonConfig extends ItemConfig<CustomRegistry, CustomHints, CustomExtras> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: TriggerDefinition<CustomRegistry, CustomConfigs, ItemControl<CustomHints>>;
}

export interface MessageConfig extends ItemConfig<CustomRegistry, CustomHints, CustomExtras> {
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
  CustomRegistry,
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
