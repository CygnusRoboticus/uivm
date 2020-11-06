import { AbstractFlags, FieldConfig, GroupConfig, ItemConfig } from "../lib/configs";
import { ItemControl } from "../lib/controls";
import { ExecutableDefinition, Executor } from "../lib/executable";
import { FieldTypeMap } from "../lib/typing";
import { CustomRegistry } from "./registry";

export interface FormConfig
  extends GroupConfig<CustomConfigs, CustomRegistry, AbstractFlags>,
    FieldConfig<CustomRegistry, AbstractFlags> {
  type: "form";
}

export interface TextConfig extends FieldConfig<CustomRegistry, AbstractFlags> {
  type: "text";
  label?: string;
  placeholder?: string;
}

export interface CheckboxConfig extends FieldConfig<CustomRegistry, AbstractFlags> {
  type: "checkbox";
  label: string;
}

export interface FormGroupConfig extends GroupConfig<CustomConfigs, CustomRegistry, AbstractFlags> {
  type: "formGroup";
}

export interface ButtonConfig extends ItemConfig<CustomRegistry, AbstractFlags> {
  type: "button";
  label: string;
  submit?: boolean;
  trigger: ExecutableDefinition<CustomRegistry["triggers"], Executor<ItemControl<AbstractFlags>, void>>;
}

export interface MessageConfig extends ItemConfig<CustomRegistry, AbstractFlags> {
  type: "message";
  title?: string;
  chrome?: "info" | "warning" | "success" | "error";
}

export type CustomConfigs = FormConfig | TextConfig | ButtonConfig | MessageConfig | FormGroupConfig | CheckboxConfig;

export type CustomConfigsTypes = FieldTypeMap<CustomConfigs, { type: "text" }, never, never, never, never>;
